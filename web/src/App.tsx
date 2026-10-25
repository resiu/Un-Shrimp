import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { DrawingUtils, PoseLandmarker } from '@mediapipe/tasks-vision'
import { CONFIG } from './config'
import { createPoseLandmarker } from './lib/pose'
import { computeAngles, PostureMonitor, type Angles, type PostureStatus } from './lib/posture'
import { playScreech, unlockAudio } from './lib/sound'
import { playRoast, SHRIMP_LEVELS } from './lib/roast'
import { arduinoSupported, connectArduino, updateArduino } from './lib/arduino'
import { Jumpscare } from './components/Jumpscare'
import { ShrimpIcon } from './components/ShrimpIcon'
import './dashboard.css'


const STATUS_LABEL: Record<PostureStatus, ReactNode> = {
  uncalibrated: 'Not calibrated',
  calibrating: 'Calibrating… sit up straight!',
  good: <>Good posture <ShrimpIcon />✨</>,
  bad: 'SLOUCHING! ⚠️',
  no_person: "Can't see you",
}

// Skeleton overlay colors. These go to MediaPipe's canvas drawing, so they can't be CSS.
const SKELETON_LINE_COLOR = '#38bdf8'
const SKELETON_DOT_COLOR = '#f43f5e'


/** What the detector reports each frame. ProfilePage uses it to send readings to the backend. */
export type FrameReport = {
  angles: Angles | null
  status: PostureStatus
  baseline: PostureMonitor['baseline']
}


export default function App({ onFrame }: { onFrame?: (frame: FrameReport) => void }) {
  // Kept in a ref so a new onFrame function doesn't restart the detection loop.
  const onFrameRef = useRef(onFrame)
  useEffect(() => {
    onFrameRef.current = onFrame
  }, [onFrame])
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const landmarkerRef = useRef<PoseLandmarker | null>(null)
  const monitorRef = useRef(new PostureMonitor())


  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([])
  const [cameraId, setCameraId] = useState('')
  const [cameraOn, setCameraOn] = useState(false)
  const [modelReady, setModelReady] = useState(false)
  const [status, setStatus] = useState<PostureStatus>('uncalibrated')
  const [angles, setAngles] = useState<Angles | null>(null)
  const [baseline, setBaseline] = useState<PostureMonitor['baseline']>(null)
  const [showJumpscare, setShowJumpscare] = useState(false)
  const [arduinoOn, setArduinoOn] = useState(false)
  const [log, setLog] = useState<string[]>([])


  const addLog = useCallback((msg: string) => {
    const t = new Date().toLocaleTimeString()
    setLog((l) => [`${t}  ${msg}`, ...l].slice(0, 40))
  }, [])


  const triggerJumpscare = useCallback(() => {
    playScreech()
    setShowJumpscare(true)
    setTimeout(() => setShowJumpscare(false), 1500)
    if (document.hidden && Notification.permission === 'granted') {
      new Notification('SIT UP STRAIGHT', {
        body: 'Posture Shrimp is watching you!',
        icon: '/cookedShrimp.png',
      })
    }
  }, [])


  // ---- Load the pose model once ----
  useEffect(() => {
    let cancelled = false
    createPoseLandmarker()
      .then((lm) => {
        if (cancelled) return lm.close()
        landmarkerRef.current = lm
        setModelReady(true)
        addLog('Pose model loaded')
      })
      .catch((err) => addLog(`Model failed to load: ${err}`))
    return () => {
      cancelled = true
    }
  }, [addLog])


  // ---- List cameras ----
  const refreshCameras = useCallback(async () => {
    const devices = await navigator.mediaDevices.enumerateDevices()
    const cams = devices.filter((d) => d.kind === 'videoinput')
    setCameras(cams)
    if (!cameraId && cams[0]) setCameraId(cams[0].deviceId)
  }, [cameraId])


  useEffect(() => {
    void refreshCameras()
  }, [refreshCameras])


  const startCamera = async () => {
    unlockAudio()
    const video = videoRef.current!
    ;(video.srcObject as MediaStream | null)?.getTracks().forEach((t) => t.stop())
    const stream = await navigator.mediaDevices.getUserMedia({
      video: cameraId ? { deviceId: { exact: cameraId } } : true,
    })
    video.srcObject = stream
    await video.play()
    setCameraOn(true)
    addLog('Camera started')
    void refreshCameras()
  }


  const calibrate = () => {
    unlockAudio()
    if ('Notification' in window && Notification.permission === 'default') {
      void Notification.requestPermission()
    }
    monitorRef.current.startCalibration()
    addLog('Calibrating — hold good posture for a few seconds')
  }


  const connectToArduino = async () => {
    try {
      await connectArduino()
      setArduinoOn(true)
      addLog('Arduino connected')
    } catch (err) {
      addLog(`Arduino not connected: ${err}`)
    }
  }


  // ---- Main detection loop ----
  useEffect(() => {
    if (!cameraOn || !modelReady) return //detecting if camera is on, if not --> do nothing
    const video = videoRef.current! //grabs <video> element
    const canvas = canvasRef.current! //grabs <canvas> element
    const ctx = canvas.getContext('2d')!
    const drawer = new DrawingUtils(ctx) //DrawingUtils is MediaPipe's helper for drawing the skeleton
    let lastVideoTime = -1 //remembers the last frame processed so the same frame isn't analyzed more than once

    // Voice-over roasts (lib/roast.ts): the first plays with the jumpscare in a human voice.
    // Still slouching? Another every roastRepeatMs, one shrimp level higher. Sitting up resets.
    let shrimpLevel = 0
    let lastRoastAt: number | null = null
    const roast = (now: number, afterScreech: boolean) => {
      void playRoast(shrimpLevel, { afterScreech })
      addLog(shrimpLevel === 0 ? 'Roast 🗣️' : `Roast 🦐 (shrimp level ${shrimpLevel})`)
      lastRoastAt = now
      shrimpLevel = Math.min(shrimpLevel + 1, SHRIMP_LEVELS - 1)
    }


    const id = setInterval(() => { //runs every 100ms
      const lm = landmarkerRef.current
      if (!lm || video.readyState < 2 || video.currentTime === lastVideoTime) return //skips iteration if video has no data yet, or else mediaPipe will throw an error
      lastVideoTime = video.currentTime


      const now = performance.now()
      const result = lm.detectForVideo(video, now)
      const pose = result.landmarks[0] //the body's first 33 body points, or undefined if nobody is detected
      const w = video.videoWidth
      const h = video.videoHeight


      // Draw skeleton overlay
      canvas.width = w
      canvas.height = h
      ctx.clearRect(0, 0, w, h)
      if (pose) { //if a person is on camera, draw the skeleton lines and joints
        drawer.drawConnectors(pose, PoseLandmarker.POSE_CONNECTIONS, {
          color: SKELETON_LINE_COLOR,
          lineWidth: 3,
        })
        drawer.drawLandmarks(pose, { color: SKELETON_DOT_COLOR, radius: 3 })
      }


      //Turns landmarks into angles (neck, torso, side), or null if ear and shoulder aren't visible
      const a = computeAngles(pose, w, h)
      setAngles(a) //updates the "Live Angles" table


      const monitor = monitorRef.current
      const events = monitor.update(a, now)
      setStatus(monitor.status)
      setBaseline(monitor.baseline)
      onFrameRef.current?.({ angles: a, status: monitor.status, baseline: monitor.baseline })
      for (const e of events) {
        if (e === 'became_bad') {
          addLog('Slouch detected')
        } else if (e === 'became_good') {
          addLog('Back to good posture')
          shrimpLevel = 0 // human voice again next time
          lastRoastAt = null
        } else if (e === 'jumpscare') {
          triggerJumpscare()
          roast(now, true)
        }
      }
      updateArduino(monitor.status, events.includes('jumpscare'))
      // Still slouching (and still in frame) since the last roast? Roast again, shrimpier.
      if (monitor.status === 'bad' && a && lastRoastAt !== null && now - lastRoastAt >= CONFIG.roastRepeatMs) {
        roast(now, false)
      }
    }, CONFIG.detectIntervalMs)


    return () => clearInterval(id) //stop the timer when camera stops
  }, [cameraOn, modelReady, addLog, triggerJumpscare]) //dependency array; tells react when to re-run this method; re-runs whenever any value in the array changes
                                                          //between renders


  const bad = status === 'bad'


  return (
    <div className="dashboard">
      <Jumpscare visible={showJumpscare} />


      {/* Swaying Kelp Assets */}
      <img src="/kelp.png" alt="Kelp Left" className="dash-kelp dash-kelp-left" />
      <img src="/kelp.png" alt="Kelp Right" className="dash-kelp dash-kelp-right" />


      {/* Floating Reactive Cooked Shrimp Mascot */}
      <div className={`dash-mascot${bad ? ' is-bad' : ''}`}>
        <img src="/cookedShrimp.png" alt="Cooked Shrimp Mascot" className="dash-mascot-img" />
        <div className="dash-mascot-text">
          <span className="dash-mascot-name">Posture Shrimp</span>
          <span className="dash-mascot-status">
            {bad ? 'Warning: Slouching!' : 'Ready & Watching'}
          </span>
        </div>
      </div>


      <div className="dash-content">
        <header className="dash-header">
          <h1 className="dash-title"><ShrimpIcon /> Posture Bot Dashboard</h1>
          <span className={`dash-pill${bad ? ' is-bad' : ''}`}>{STATUS_LABEL[status]}</span>
        </header>


        {/* System Controls */}
        <section className="dash-panel dash-controls">
          <label className="dash-label">
            Camera
            <select
              value={cameraId}
              onChange={(e) => setCameraId(e.target.value)}
              className="dash-select"
            >
              {cameras.length === 0 && <option value="">(click Start camera)</option>}
              {cameras.map((c, i) => (
                <option key={c.deviceId || i} value={c.deviceId}>
                  {c.label || `Camera ${i + 1}`}
                </option>
              ))}
            </select>
          </label>
          <button onClick={startCamera} className="dash-btn">{cameraOn ? 'Switch camera' : '1. Start camera'}</button>
          <button onClick={calibrate} disabled={!cameraOn || !modelReady} className="dash-btn dash-btn-primary">
            2. Calibrate
          </button>
          <button onClick={connectToArduino} disabled={!arduinoSupported} className="dash-btn">
            {arduinoOn ? 'Reconnect Arduino' : 'Connect Arduino'}
          </button>
        </section>


        {/* Main Camera & Stats Grid */}
        <main className="dash-main">
          <div className="dash-stage">
            <video ref={videoRef} playsInline muted className="dash-video" />
            <canvas ref={canvasRef} className="dash-canvas" />
            {!cameraOn && <div className="dash-stage-empty">Camera is off</div>}
          </div>


          <aside className="dash-panel dash-side">
            <h3 className="dash-heading">Live Posture Angles</h3>
            <table className="dash-table">
              <thead>
                <tr>
                  <th>Measure</th>
                  <th>Now</th>
                  <th>Base</th>
                  <th>Limit</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Head size</td>
                  <td>{fmt(angles?.face)}</td>
                  <td>{fmt(baseline?.face)}</td>
                  <td>{baseline ? fmt(baseline.face * (1 + CONFIG.faceGrowth)) : '—'}</td>
                </tr>
                <tr>
                  <td>Neck gap</td>
                  <td>{fmt(angles?.neck)}</td>
                  <td>{fmt(baseline?.neck)}</td>
                  <td>{baseline ? fmt(baseline.neck * (1 - CONFIG.neckDrop)) : '—'}</td>
                </tr>
                <tr>
                  <td>Shoulder tilt</td>
                  <td>{fmt(angles?.tilt)}</td>
                  <td>{fmt(baseline?.tilt)}</td>
                  <td>{baseline ? fmt(baseline.tilt + CONFIG.tiltTolerance) : '—'}</td>
                </tr>
              </tbody>
            </table>


            <h3 className="dash-heading">Event Log</h3>
            <ol className="dash-log">
              {log.map((l, i) => (
                <li key={i}>{l}</li>
              ))}
            </ol>
          </aside>
        </main>


        {/* Ocean bubbles: links to the real Leaderboard and Shrimp Stats pages */}
        <section className="dash-bubbles">
          <h2 className="dash-bubbles-title">🌊 Interactive Posture Bubbles</h2>


          <div className="dash-bubble-row">
            <Link to="/leaderboard" className="dash-bubble">
              <img src="/bubble1.png" alt="Bubble 1" className="dash-bubble-img" />
              <div className="dash-bubble-overlay">
                <span className="dash-bubble-icon">🏆</span>
                <span className="dash-bubble-label">Most Shrimp Leadership</span>
              </div>
            </Link>


            <Link to="/profile" className="dash-bubble">
              <img src="/bubble2.png" alt="Bubble 2" className="dash-bubble-img" />
              <div className="dash-bubble-overlay">
                <span className="dash-bubble-icon">📊</span>
                <span className="dash-bubble-label">Current Shrimp Stats</span>
              </div>
            </Link>
          </div>
        </section>
      </div>
    </div>
  )
}


function fmt(n: number | null | undefined) {
  // return n == null ? '—' : `${n.toFixed(1)}°`
  return n == null ? '-' : n.toFixed(2);
}

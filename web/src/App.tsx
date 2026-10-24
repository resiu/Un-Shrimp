import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { DrawingUtils, PoseLandmarker } from '@mediapipe/tasks-vision'
import { CONFIG } from './config'
import { createPoseLandmarker } from './lib/pose'
import { computeAngles, PostureMonitor, type Angles, type PostureStatus } from './lib/posture'
import { playScreech, unlockAudio } from './lib/sound'
import { Jumpscare } from './components/Jumpscare'
import './dashboard.css'


const STATUS_LABEL: Record<PostureStatus, string> = {
  uncalibrated: 'Not calibrated',
  calibrating: 'Calibrating… sit up straight!',
  good: 'Good posture 🦐✨',
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
      new Notification('SIT UP STRAIGHT 🦐', { body: 'Posture Shrimp is watching you!' })
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


  // ---- Main detection loop ----
  useEffect(() => {
    if (!cameraOn || !modelReady) return
    const video = videoRef.current!
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    const drawer = new DrawingUtils(ctx)
    let lastVideoTime = -1


    const id = setInterval(() => {
      const lm = landmarkerRef.current
      if (!lm || video.readyState < 2 || video.currentTime === lastVideoTime) return
      lastVideoTime = video.currentTime


      const now = performance.now()
      const result = lm.detectForVideo(video, now)
      const pose = result.landmarks[0]
      const w = video.videoWidth
      const h = video.videoHeight


      // Draw skeleton overlay
      canvas.width = w
      canvas.height = h
      ctx.clearRect(0, 0, w, h)
      if (pose) {
        drawer.drawConnectors(pose, PoseLandmarker.POSE_CONNECTIONS, {
          color: SKELETON_LINE_COLOR,
          lineWidth: 3,
        })
        drawer.drawLandmarks(pose, { color: SKELETON_DOT_COLOR, radius: 3 })
      }


      const a = computeAngles(pose, w, h)
      setAngles(a)


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
        } else if (e === 'jumpscare') {
          triggerJumpscare()
        }
      }
    }, CONFIG.detectIntervalMs)


    return () => clearInterval(id)
  }, [cameraOn, modelReady, addLog, triggerJumpscare])


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
          <h1 className="dash-title">🦐 Posture Bot Dashboard</h1>
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
                  <th>Angle</th>
                  <th>Now</th>
                  <th>Base</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Neck</td>
                  <td>{fmt(angles?.neck)}</td>
                  <td>{fmt(baseline?.neck)}</td>
                </tr>
                <tr>
                  <td>Torso</td>
                  <td>{fmt(angles?.torso)}</td>
                  <td>{fmt(baseline?.torso)}</td>
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
  return n == null ? '—' : `${n.toFixed(1)}°`
}

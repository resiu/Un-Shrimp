//where the main methods and features for the app happens here 

import { useCallback, useEffect, useRef, useState } from 'react'
import { DrawingUtils, PoseLandmarker } from '@mediapipe/tasks-vision'
import { CONFIG } from './config'
import { createPoseLandmarker } from './lib/pose'
import { computeAngles, PostureMonitor, type Angles, type PostureStatus } from './lib/posture'
import { playScreech, unlockAudio } from './lib/sound'
import { Jumpscare } from './components/Jumpscare'

const STATUS_LABEL: Record<PostureStatus, string> = {
  uncalibrated: 'Not calibrated',
  calibrating: 'Calibrating… sit up straight!',
  good: 'Good posture',
  bad: 'SLOUCHING',
  no_person: "Can't see you",
}

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
    // If the tab is in the background, at least pop a system notification.
    if (document.hidden && Notification.permission === 'granted') {
      new Notification('SIT UP STRAIGHT 👹', { body: 'Posture Bot is watching you.' })
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

  // ---- List cameras (labels only appear after permission is granted once) ----
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
    void refreshCameras() // now we get real camera names
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
    if (!cameraOn || !modelReady) return //detecting if camera is on, if not --> do nothing
    const video = videoRef.current! //grabs <video> element
    const canvas = canvasRef.current! //grabs <canvas> element
    const ctx = canvas.getContext('2d')!
    const drawer = new DrawingUtils(ctx) //DrawingUtils is MediaPipe's helper for drawing the skeleton
    let lastVideoTime = -1 //remembers the last frame processed so the same frame isn't analyzed more than once

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
          color: '#e0b04f',
          lineWidth: 3,
        })
        drawer.drawLandmarks(pose, { color: '#ff5a36', radius: 3 })
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
        } else if (e === 'jumpscare') {
          triggerJumpscare()
        }
      }
    }, CONFIG.detectIntervalMs)

    return () => clearInterval(id) //stop the timer when camera stops
  }, [cameraOn, modelReady, addLog, triggerJumpscare]) //dependency array; tells react when to re-run this method; re-runs whenever any value in the array changes     
                                                          //between renders

  return (
    <div className={`app status-${status}`}>
      <Jumpscare visible={showJumpscare} />

      <header>
        <h1>Posture Bot</h1>
        <span className={`pill pill-${status}`}>{STATUS_LABEL[status]}</span>
      </header>

      <section className="controls">
        <label>
          Camera
          <select value={cameraId} onChange={(e) => setCameraId(e.target.value)}>
            {cameras.length === 0 && <option value="">(click Start camera)</option>}
            {cameras.map((c, i) => (
              <option key={c.deviceId || i} value={c.deviceId}>
                {c.label || `Camera ${i + 1}`}
              </option>
            ))}
          </select>
        </label>
        <button onClick={startCamera}>{cameraOn ? 'Switch camera' : '1. Start camera'}</button>
        <button onClick={calibrate} disabled={!cameraOn || !modelReady} className="primary">
          2. Calibrate (sit up straight)
        </button>
      </section>
      {!modelReady && <p className="muted">Loading pose model…</p>}

      <main>
        <div className="stage">
          <video ref={videoRef} playsInline muted />
          <canvas ref={canvasRef} />
          {!cameraOn && <div className="stage-empty">Camera off</div>}
        </div>

        <aside>
          <h2>Live angles</h2>
          <table>
            <thead>
              <tr>
                <th></th>
                <th>Now</th>
                <th>Baseline</th>
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
          {/* <p className="muted small">Side seen: {angles?.side ?? '—'}</p> */}



          <h2>Log</h2>
          <ol className="log">
            {log.map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ol>
        </aside>
      </main>
    </div>
  )
}

function fmt(n: number | null | undefined) {
  // return n == null ? '—' : `${n.toFixed(1)}°`
  return n == null ? '-' : n.toFixed(2);
}

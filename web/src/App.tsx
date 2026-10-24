import { useCallback, useEffect, useRef, useState } from 'react'
import { DrawingUtils, PoseLandmarker } from '@mediapipe/tasks-vision'
import { CONFIG } from './config'
import { createPoseLandmarker } from './lib/pose'
import { computeAngles, PostureMonitor, type Angles, type PostureStatus } from './lib/posture'
import { ArduinoLink, type RobotCommand } from './lib/serial'
import { playScreech, unlockAudio } from './lib/sound'
import { Jumpscare } from './components/Jumpscare'

const STATUS_LABEL: Record<PostureStatus, string> = {
  uncalibrated: 'Not calibrated',
  calibrating: 'Calibrating… sit up straight!',
  good: 'Good posture',
  bad: 'SLOUCHING',
  no_person: "Can't see you",
}

export default function App() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const landmarkerRef = useRef<PoseLandmarker | null>(null)
  const monitorRef = useRef(new PostureMonitor())
  const arduinoRef = useRef(new ArduinoLink())

  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([])
  const [cameraId, setCameraId] = useState('')
  const [cameraOn, setCameraOn] = useState(false)
  const [modelReady, setModelReady] = useState(false)
  const [robotConnected, setRobotConnected] = useState(false)
  const [status, setStatus] = useState<PostureStatus>('uncalibrated')
  const [angles, setAngles] = useState<Angles | null>(null)
  const [baseline, setBaseline] = useState<PostureMonitor['baseline']>(null)
  const [showJumpscare, setShowJumpscare] = useState(false)
  const [log, setLog] = useState<string[]>([])

  const addLog = useCallback((msg: string) => {
    const t = new Date().toLocaleTimeString()
    setLog((l) => [`${t}  ${msg}`, ...l].slice(0, 40))
  }, [])

  const sendRobot = useCallback(
    (cmd: RobotCommand) => {
      void arduinoRef.current.send(cmd)
      addLog(`→ robot: ${cmd}`)
    },
    [addLog],
  )

  const triggerJumpscare = useCallback(() => {
    sendRobot('J')
    playScreech()
    setShowJumpscare(true)
    setTimeout(() => setShowJumpscare(false), 1500)
    // If the tab is in the background, at least pop a system notification.
    if (document.hidden && Notification.permission === 'granted') {
      new Notification('SIT UP STRAIGHT 👹', { body: 'Posture Bot is watching you.' })
    }
  }, [sendRobot])

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

  const connectRobot = async () => {
    const link = arduinoRef.current
    link.onLine = (line) => addLog(`← robot: ${line}`)
    link.onDisconnect = () => {
      setRobotConnected(false)
      addLog('Robot disconnected')
    }
    try {
      await link.connect()
      setRobotConnected(true)
      addLog('Robot connected')
    } catch (err) {
      addLog(`Robot connect failed: ${err}`)
    }
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
          color: '#e0b04f',
          lineWidth: 3,
        })
        drawer.drawLandmarks(pose, { color: '#ff5a36', radius: 3 })
      }

      const a = computeAngles(pose, w, h)
      setAngles(a)

      const monitor = monitorRef.current
      const events = monitor.update(a, now)
      setStatus(monitor.status)
      setBaseline(monitor.baseline)
      for (const e of events) {
        if (e === 'became_bad') {
          sendRobot('B')
          addLog('Slouch detected')
        } else if (e === 'became_good') {
          sendRobot('G')
          addLog('Back to good posture')
        } else if (e === 'jumpscare') {
          triggerJumpscare()
        }
      }
    }, CONFIG.detectIntervalMs)

    return () => clearInterval(id)
  }, [cameraOn, modelReady, addLog, sendRobot, triggerJumpscare])

  const serialSupported = ArduinoLink.isSupported()

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
        <button onClick={connectRobot} disabled={!serialSupported || robotConnected}>
          {robotConnected ? 'Robot connected ✓' : '2. Connect robot'}
        </button>
        <button onClick={calibrate} disabled={!cameraOn || !modelReady} className="primary">
          3. Calibrate (sit up straight)
        </button>
      </section>
      {!serialSupported && (
        <p className="warn">Web Serial isn't supported here. Use Chrome or Edge on a laptop.</p>
      )}
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
                <td>Neck</td>
                <td>{fmt(angles?.neck)}</td>
                <td>{fmt(baseline?.neck)}</td>
                <td>{baseline ? fmt(baseline.neck + CONFIG.neckToleranceDeg) : '—'}</td>
              </tr>
              <tr>
                <td>Torso</td>
                <td>{fmt(angles?.torso)}</td>
                <td>{fmt(baseline?.torso)}</td>
                <td>
                  {baseline?.torso != null
                    ? fmt(baseline.torso + CONFIG.torsoToleranceDeg)
                    : 'neck only'}
                </td>
              </tr>
            </tbody>
          </table>
          <p className="muted small">Side seen: {angles?.side ?? '—'}</p>

          <h2>Test the robot</h2>
          <div className="row">
            <button onClick={() => sendRobot('G')}>Calm (G)</button>
            <button onClick={() => sendRobot('B')}>Angry (B)</button>
            <button onClick={triggerJumpscare}>Jumpscare (J)</button>
          </div>

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
  return n == null ? '—' : `${n.toFixed(1)}°`
}

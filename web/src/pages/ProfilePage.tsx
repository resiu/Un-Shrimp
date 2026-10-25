// "Shrimp Stats": your numbers (live) + Start/Stop Monitoring + the posture detector.
//
// How the detector connects to the backend:
//   1. <App onFrame> (the existing detector) reports every frame; we keep only the latest.
//   2. Start Monitoring creates a session (POST /api/sessions).
//   3. Every 5 s while monitoring, the latest frame becomes a reading (lib/reading.ts)
//      and goes to POST /api/posture.
//   4. The backend replies over the WebSocket with fresh stats ("myStats").

import { useCallback, useEffect, useRef, useState } from 'react'
import App, { type FrameReport } from '../App'
import { api, type MyStats } from '../api/http'
import { onSocketMessage } from '../api/socket'
import { REPORT_INTERVAL_MS, toReading } from '../lib/reading'
import { AnimatedShrimp } from '../components/AnimatedShrimp'
import { noteFrame } from '../lib/arduino'
import { publishFrame } from '../lib/frameFeed'

export function ProfilePage() {
  const [stats, setStats] = useState<MyStats | null>(null)
  const [sessionId, setSessionId] = useState<number | null>(null)
  const [notice, setNotice] = useState('')
  const latestFrame = useRef<FrameReport | null>(null)

  // Load my stats, then keep them updated from the WebSocket.
  useEffect(() => {
    api.me().then(setStats, (err) => setNotice(err.message))
    return onSocketMessage((msg) => {
      if (msg.type === 'myStats') setStats(msg.data)
    })
  }, [])

  const handleFrame = useCallback((frame: FrameReport) => {
    latestFrame.current = frame
    noteFrame(frame) // the Arduino LED uses the same frame (lib/arduino.ts)
    publishFrame(frame) // ...and so does the animated shrimp (lib/frameFeed.ts)
  }, [])

  const startMonitoring = async () => {
    if (!latestFrame.current?.baseline) {
      setNotice('Calibrate first: pick your camera under "Select camera", sit up straight, then click "Calibrate".')
      return
    }
    try {
      const { sessionId } = await api.startSession()
      setSessionId(sessionId)
      setNotice('Monitoring… a reading is sent every 5 seconds.')
    } catch (err) {
      setNotice(err instanceof Error ? err.message : String(err))
    }
  }

  const stopMonitoring = () => {
    setSessionId(null)
    setNotice('Monitoring stopped.')
  }

  // While monitoring: send the latest frame every 5 s.
  useEffect(() => {
    if (sessionId === null) return
    const id = setInterval(() => {
      const reading = toReading(latestFrame.current)
      if (!reading) return // calibrating, or nobody in frame: skip this one
      api.sendReading({ sessionId, ...reading }).catch((err) => setNotice(err.message))
    }, REPORT_INTERVAL_MS)
    return () => clearInterval(id)
  }, [sessionId])

  return (
    <div className="page">
      <h1>Shrimp Stats <AnimatedShrimp mode="loop" />{stats && ` · ${stats.username}`}</h1>

      <div className="stat-grid">
        <Stat label="Avg score" value={stats?.avgScore ?? '—'} />
        <Stat label="Slouching" value={stats?.slouchPct == null ? '—' : `${stats.slouchPct}%`} />
        <Stat label="Readings" value={stats?.totalReadings ?? '—'} />
        <Stat label="Sessions" value={stats?.sessions ?? '—'} />
        <Stat
          label="Improvement"
          value={stats?.improvement == null ? '—' : `${stats.improvement > 0 ? '+' : ''}${stats.improvement} pts`}
        />
      </div>

      <div className="monitor-bar">
        {sessionId === null ? (
          <button className="primary" onClick={startMonitoring}>
            Start Monitoring
          </button>
        ) : (
          <button onClick={stopMonitoring}>Stop Monitoring</button>
        )}
        {notice && <span className={notice.startsWith('Calibrate') ? 'warn' : 'muted'}>{notice}</span>}
      </div>

      {/* The existing detector, unchanged except for the onFrame hook. */}
      <App onFrame={handleFrame} />
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="card stat">
      <div className="muted small">{label}</div>
      <div className="stat-value">{value}</div>
    </div>
  )
}

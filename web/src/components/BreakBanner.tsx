// Shown at the top of the Leaderboard during a break.
// Opens the camera, checks whether you're still in view, and tells the Pomodoro clock.
// "In view" = the same check the posture detector uses (nose, both ears and both shoulders visible).
// You count as "away" after being out of view for CONFIG.awayGraceMs.

import { useEffect, useRef, useState } from 'react'
import type { PoseLandmarker } from '@mediapipe/tasks-vision'
import { CONFIG } from '../config'
import { createPoseLandmarker } from '../lib/pose'
import { computeAngles } from '../lib/posture'
import { fmtClock, usePomodoro } from '../pomodoro/PomodoroContext'

type Presence = 'starting' | 'here' | 'away' | 'no_camera'

export function BreakBanner() {
  const { remainingMs, reportAway } = usePomodoro()
  const videoRef = useRef<HTMLVideoElement>(null)
  const [presence, setPresence] = useState<Presence>('starting')

  useEffect(() => {
    let cancelled = false
    let stream: MediaStream | null = null
    let landmarker: PoseLandmarker | null = null
    let timer: ReturnType<typeof setInterval> | undefined
    let lastSeenAt = performance.now()
    let detectionErrorReported = false

    // Don't let the break clock run while the camera and model are still loading.
    reportAway(false)

    const release = () => {
      clearInterval(timer)
      stream?.getTracks().forEach((t) => t.stop())
      landmarker?.close()
      stream = null
      landmarker = null
    }

    async function begin() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true })
        if (cancelled) return release()
        const video = videoRef.current!
        video.srcObject = stream
        await video.play()
        landmarker = await createPoseLandmarker()
        if (cancelled) return release()

        lastSeenAt = performance.now()
        timer = setInterval(() => {
          const cameraLive = stream?.getVideoTracks().some((track) => track.readyState === 'live')
          if (!landmarker || !cameraLive || video.readyState < 2) {
            reportAway(null)
            setPresence('no_camera')
            return
          }
          const now = performance.now()
          try {
            const result = landmarker.detectForVideo(video, now)
            const seen =
              computeAngles(result.landmarks[0], video.videoWidth, video.videoHeight) !== null
            detectionErrorReported = false
            if (seen) lastSeenAt = now
            const away = now - lastSeenAt >= CONFIG.awayGraceMs
            reportAway(away)
            setPresence(away ? 'away' : 'here')
          } catch (err) {
            if (!detectionErrorReported) {
              console.warn('Break presence detection failed', err)
              detectionErrorReported = true
            }
            reportAway(null)
            setPresence('no_camera')
          }
        }, CONFIG.detectIntervalMs)
      } catch (err) {
        console.warn('Break camera or pose model could not start', err)
        if (!cancelled) {
          reportAway(null)
          setPresence('no_camera')
        }
      }
    }
    void begin()

    return () => {
      cancelled = true
      release()
      reportAway(null)
    }
  }, [reportAway])

  const message = {
    starting: 'Starting the camera…',
    here: "I can still see you. Walk out of view: the break clock only runs while you're away.",
    away: 'Nice, keep walking! The break clock is running.',
    no_camera: 'Camera or pose detection unavailable. The break clock is paused until it works.',
  }[presence]

  return (
    <div className={`break-banner is-${presence}`} role="status">
      <video ref={videoRef} className="break-cam" playsInline muted />
      <div className="break-text">
        <strong>Break time! Get up and walk around 🚶</strong>
        <span className="muted">{message}</span>
      </div>
      <div className="break-clock">{fmtClock(remainingMs)}</div>
    </div>
  )
}
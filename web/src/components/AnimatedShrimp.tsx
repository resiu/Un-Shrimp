// The animated shrimp mascot. Four frames in web/public/shrimp/: 1 = stretched out ... 4 = ball.
//
// mode="posture" (default): follows your live posture score (lib/reading.ts, 100 = straight),
//   stepping one frame at a time so it curls and uncurls smoothly instead of jumping.
//   Before calibration it stays uncurled; while you're out of view it holds its pose.
// mode="loop": curls and uncurls forever (1-2-3-4-3-2-1...), no matter your posture.

import { useEffect, useRef, useState } from 'react'
import type { FrameReport } from '../App'
import { CONFIG } from '../config'
import { onFrameReport } from '../lib/frameFeed'
import { toReading } from '../lib/reading'

const FRAMES = ['/shrimp/shrimp1.png', '/shrimp/shrimp2.png', '/shrimp/shrimp3.png', '/shrimp/shrimp4.png']

// Load every frame up front so swapping frames never flickers.
for (const src of FRAMES) new Image().src = src

/** Which frame (0-3) the shrimp should end up on, or null to keep its current pose. */
function targetFrame(frame: FrameReport): number | null {
  if (frame.status === 'uncalibrated' || frame.status === 'calibrating') return 0
  const reading = toReading(frame)
  if (!reading) return null // out of view
  const curlsAfter = CONFIG.shrimpCurlScores.filter((score) => reading.score < score).length
  return Math.min(curlsAfter, FRAMES.length - 1)
}

/** size: "sm" = text-sized, "xl" = the big Pomodoro button. */
export function AnimatedShrimp({
  size = 'sm',
  mode = 'posture',
}: {
  size?: 'sm' | 'xl'
  mode?: 'posture' | 'loop'
}) {
  const [shown, setShown] = useState(0)
  const target = useRef(0)

  useEffect(() => {
    if (mode !== 'posture') return
    return onFrameReport((frame) => {
      const t = targetFrame(frame)
      if (t !== null) target.current = t
    })
  }, [mode])

  useEffect(() => {
    if (mode === 'loop') {
      // Ping-pong through the frames: 1-2-3-4-3-2, then repeat.
      const sequence = [0, 1, 2, 3, 2, 1]
      let step = 0
      const id = setInterval(() => {
        step = (step + 1) % sequence.length
        setShown(sequence[step])
      }, CONFIG.shrimpLoopStepMs)
      return () => clearInterval(id)
    }
    // Posture: step one frame toward the target every shrimpCurlStepMs.
    const id = setInterval(() => {
      setShown((now) => (now === target.current ? now : now + Math.sign(target.current - now)))
    }, CONFIG.shrimpCurlStepMs)
    return () => clearInterval(id)
  }, [mode])

  return <img src={FRAMES[shown]} alt="" className={`shrimp-anim shrimp-anim--${size}`} />
}

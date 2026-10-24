// Turns one detector frame into the reading we send to POST /api/posture.
// Reuses the front-view thresholds in config.ts (the same three checks as
// PostureMonitor.isSlouchedFrame), so tuning them there also changes the score.

import type { FrameReport } from '../App'
import { CONFIG } from '../config'

/** How often a reading is sent while monitoring. */
export const REPORT_INTERVAL_MS = 5000

// The API fields are still called neckAngle/shoulderAngle (from the old side view).
// With the front view they carry ratios instead of degrees:
//   neckAngle     = angles.neck  (nose-to-shoulder gap / shoulder width)
//   shoulderAngle = angles.tilt  (shoulder height difference / shoulder width)
export type ReadingValues = {
  neckAngle: number
  shoulderAngle: number | null
  slouching: boolean
  score: number // 0-100, 100 = straight
}

/**
 * Returns null when there's nothing worth sending: not calibrated yet,
 * calibrating right now, or nobody in frame.
 *
 * score: 100 at your calibrated posture, 50 right at the slouch threshold,
 * 0 at twice the threshold. Uses whichever of face/neck/tilt is worst.
 * slouching: the detector's own decision (status "bad", which waits badHoldMs).
 */
export function toReading(frame: FrameReport | null): ReadingValues | null {
  if (!frame) return null
  const { angles, status, baseline } = frame
  if (!angles || !baseline || (status !== 'good' && status !== 'bad')) return null

  // How far past baseline, measured in "thresholds" (1 = exactly at the threshold).
  const faceOver = (angles.face / baseline.face - 1) / CONFIG.faceGrowth // head toward camera
  const neckOver = (1 - angles.neck / baseline.neck) / CONFIG.neckDrop // head sinking
  const tiltOver = (angles.tilt - baseline.tilt) / CONFIG.tiltTolerance // leaning sideways
  const worst = Math.max(0, faceOver, neckOver, tiltOver)
  const score = Number.isFinite(worst) ? Math.round(Math.min(100, Math.max(0, 100 - worst * 50))) : 0

  return {
    neckAngle: round3(angles.neck),
    shoulderAngle: round3(angles.tilt),
    slouching: status === 'bad',
    score,
  }
}

const round3 = (n: number) => Math.round(n * 1000) / 1000

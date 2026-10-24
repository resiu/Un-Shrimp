// Turns one detector frame into the reading we send to POST /api/posture.
// Reuses the thresholds in config.ts, so tuning them there also changes the score.

import type { FrameReport } from '../App'
import { CONFIG } from '../config'

/** How often a reading is sent while monitoring. */
export const REPORT_INTERVAL_MS = 5000

export type ReadingValues = {
  neckAngle: number
  shoulderAngle: number | null // the torso angle (shoulder over hip); null if hips are hidden
  slouching: boolean
  score: number // 0-100, 100 = straight
}

/**
 * Returns null when there's nothing worth sending: not calibrated yet,
 * calibrating right now, or nobody in frame.
 *
 * score: 100 at your calibrated posture, 50 right at the slouch threshold,
 * 0 at twice the threshold. Uses whichever of neck/torso is worse.
 * slouching: the detector's own decision (status "bad", which waits badHoldMs).
 */
export function toReading(frame: FrameReport | null): ReadingValues | null {
  if (!frame) return null
  const { angles, status, baseline } = frame
  if (!angles || !baseline || (status !== 'good' && status !== 'bad')) return null

  // How far past baseline, measured in "thresholds" (1 = exactly at the threshold).
  const neckOver = (angles.neck - baseline.neck) / CONFIG.neckToleranceDeg
  const torsoOver =
    angles.torso !== null && baseline.torso !== null
      ? (angles.torso - baseline.torso) / CONFIG.torsoToleranceDeg
      : 0
  const worst = Math.max(0, neckOver, torsoOver)

  return {
    neckAngle: round1(angles.neck),
    shoulderAngle: angles.torso === null ? null : round1(angles.torso),
    slouching: status === 'bad',
    score: Math.round(Math.min(100, Math.max(0, 100 - worst * 50))),
  }
}

const round1 = (n: number) => Math.round(n * 10) / 10

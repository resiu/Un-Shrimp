import type { NormalizedLandmark } from '@mediapipe/tasks-vision'
import { CONFIG } from '../config'

// MediaPipe Pose landmark indices (33 total). We only need these:
const LM = {
  leftEar: 7,
  rightEar: 8,
  leftShoulder: 11,
  rightShoulder: 12,
  leftHip: 23,
  rightHip: 24,
} as const

export type Angles = {
  side: 'left' | 'right'
  /** Degrees the ear leans forward of straight-above-the-shoulder. 0 = perfectly stacked. */
  neck: number
  /** Degrees the shoulder leans away from straight-above-the-hip. null if hips not visible. */
  torso: number | null
}

/**
 * Angle (degrees) between the line lower→upper and straight vertical.
 * Uses pixel units so a wide video doesn't distort the angle.
 */
function angleFromVertical(
  lower: NormalizedLandmark,
  upper: NormalizedLandmark,
  width: number,
  height: number,
): number {
  const dx = (upper.x - lower.x) * width
  const dy = (lower.y - upper.y) * height // image y grows downward, so flip
  return (Math.atan2(Math.abs(dx), dy) * 180) / Math.PI
}

const visible = (p: NormalizedLandmark | undefined) =>
  !!p && (p.visibility ?? 0) >= CONFIG.minVisibility

/**
 * Turn one frame of landmarks into posture angles.
 * The camera sees you from the side, so we use whichever side (left/right)
 * the camera can see better.
 */
export function computeAngles(
  landmarks: NormalizedLandmark[] | undefined,
  width: number,
  height: number,
): Angles | null {
  if (!landmarks || landmarks.length < 25) return null

  const score = (ear: number, shoulder: number, hip: number) =>
    (landmarks[ear].visibility ?? 0) +
    (landmarks[shoulder].visibility ?? 0) +
    (landmarks[hip].visibility ?? 0)

  const useLeft =
    score(LM.leftEar, LM.leftShoulder, LM.leftHip) >=
    score(LM.rightEar, LM.rightShoulder, LM.rightHip)

  const ear = landmarks[useLeft ? LM.leftEar : LM.rightEar]
  const shoulder = landmarks[useLeft ? LM.leftShoulder : LM.rightShoulder]
  const hip = landmarks[useLeft ? LM.leftHip : LM.rightHip]

  if (!visible(ear) || !visible(shoulder)) return null

  return {
    side: useLeft ? 'left' : 'right',
    neck: angleFromVertical(shoulder, ear, width, height),
    // Hips are often hidden behind the desk; that's fine, we fall back to neck only.
    torso: visible(hip) ? angleFromVertical(hip, shoulder, width, height) : null,
  }
}

export type PostureStatus = 'uncalibrated' | 'calibrating' | 'good' | 'bad' | 'no_person'
export type PostureEvent = 'became_bad' | 'became_good' | 'jumpscare'

type Baseline = { neck: number; torso: number | null }

/**
 * Turns noisy per-frame angles into calm, debounced decisions.
 *
 *   good --(slouched for badHoldMs)--> bad --(still slouched jumpscareAfterBadMs)--> jumpscare
 *   bad  --(upright for goodHoldMs)--> good
 */
export class PostureMonitor {
  status: PostureStatus = 'uncalibrated'
  baseline: Baseline | null = null

  private calibrationSamples: Angles[] = []
  private slouchSince: number | null = null
  private uprightSince: number | null = null
  private badSince: number | null = null
  private lastJumpscare = -Infinity
  private jumpscaredThisSlouch = false

  startCalibration() {
    this.calibrationSamples = []
    this.status = 'calibrating'
  }

  /** Is this single frame slouched compared to the baseline? */
  isSlouchedFrame(a: Angles): boolean {
    if (!this.baseline) return false
    const neckBad = a.neck > this.baseline.neck + CONFIG.neckToleranceDeg
    const torsoBad =
      a.torso !== null &&
      this.baseline.torso !== null &&
      a.torso > this.baseline.torso + CONFIG.torsoToleranceDeg
    return neckBad || torsoBad
  }

  /** Call once per detection frame. Returns any events that happened this frame. */
  update(a: Angles | null, now: number): PostureEvent[] {
    const events: PostureEvent[] = []

    if (this.status === 'calibrating') {
      if (a) this.calibrationSamples.push(a)
      if (this.calibrationSamples.length >= CONFIG.calibrationFrames) {
        this.baseline = averageBaseline(this.calibrationSamples)
        this.status = 'good'
      }
      return events
    }

    if (!this.baseline) return events

    if (!a) {
      // Nobody in frame (or camera can't see ear/shoulder). Don't punish, don't reset mood.
      this.slouchSince = null
      this.uprightSince = null
      if (this.status !== 'bad') this.status = 'no_person'
      return events
    }
    if (this.status === 'no_person') this.status = 'good'

    if (this.isSlouchedFrame(a)) {
      this.uprightSince = null
      this.slouchSince ??= now
      if (this.status === 'good' && now - this.slouchSince >= CONFIG.badHoldMs) {
        this.status = 'bad'
        this.badSince = now
        this.jumpscaredThisSlouch = false
        events.push('became_bad')
      }
      if (
        this.status === 'bad' &&
        !this.jumpscaredThisSlouch &&
        this.badSince !== null &&
        now - this.badSince >= CONFIG.jumpscareAfterBadMs &&
        now - this.lastJumpscare >= CONFIG.jumpscareCooldownMs
      ) {
        this.lastJumpscare = now
        this.jumpscaredThisSlouch = true
        events.push('jumpscare')
      }
    } else {
      this.slouchSince = null
      this.uprightSince ??= now
      if (this.status === 'bad' && now - this.uprightSince >= CONFIG.goodHoldMs) {
        this.status = 'good'
        this.badSince = null
        events.push('became_good')
      }
    }
    return events
  }
}

function averageBaseline(samples: Angles[]): Baseline {
  const neck = samples.reduce((s, a) => s + a.neck, 0) / samples.length
  const torsos = samples.map((a) => a.torso).filter((t): t is number => t !== null)
  // Only trust torso if hips were visible in most calibration frames.
  const torso =
    torsos.length >= samples.length * 0.6
      ? torsos.reduce((s, t) => s + t, 0) / torsos.length
      : null
  return { neck, torso }
}

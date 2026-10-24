import type { NormalizedLandmark } from '@mediapipe/tasks-vision'
import { CONFIG } from '../config'
//This is where the angle math and slouch decision lives
// MediaPipe Pose landmark indices (33 total). We only need these:

/*For pose landmark */
// const LM = { //mediaPipe returns their landmarks/joints in a fixed order, so these numbers are the positions  
//   leftEar: 7,
//   rightEar: 8,
//   leftShoulder: 11,
//   rightShoulder: 12,
//   leftHip: 23,
//   rightHip: 24,
// } as const

/*For face landmark */
const LM = { //mediaPipe returns their landmarks/joints in a fixed order, so these numbers are the positions  
  nose: 0,
  leftEar: 7,
  rightEar: 8,
  leftShoulder: 11,
  rightShoulder: 12,
} as const

/*for side-view detection*/
// export type Angles = { //the output of a frame's analysis
//   side: 'left' | 'right'
//   /** Degrees the ear leans forward of straight-above-the-shoulder. 0 = perfectly stacked. */
//   neck: number
//   /** Degrees the shoulder leans away from straight-above-the-hip. null if hips not visible. */
//   torso: number | null
// }

/*For front-view detection */
/** All values are divided by shoulder width, so moving closer/farther doesn't change them. */
export type Angles = {
  /** Ear-to-ear distance. Grows when your head moves toward the camera. */
  face: number
  /** Gap from nose up to the shoulder line. Shrinks when your head drops. */
  neck: number
  /** Height difference between shoulders. Grows when you lean to one side. */
  tilt: number
}

/**
 * Angle (degrees) between the line lower→upper and straight vertical.
 * Uses pixel units so a wide video doesn't distort the angle.
 * Used for side-view detection
 */
// function angleFromVertical(
//   lower: NormalizedLandmark,
//   upper: NormalizedLandmark,
//   width: number,
//   height: number,
// ): number {
//   const dx = (upper.x - lower.x) * width //how far sideways the upper point is from the lower one, in pixels (landmarks are 0-1, so multiplying by the video size avoids 
//                                           //distortion on a wide image)
//   const dy = (lower.y - upper.y) * height // image y grows downward, so a point higher on the screen is smaller
//   return (Math.atan2(Math.abs(dx), dy) * 180) / Math.PI // Math.abs(dx), leaning forward and backward counts the same as the same positive angle
//                                                         // atan2() - has two points (upper and lower). If stacked on top of each other, degree is 0 (straight)
// }

const visible = (p: NormalizedLandmark | undefined) =>
  !!p && (p.visibility ?? 0) >= CONFIG.minVisibility

/**
 * Turn one frame of landmarks into posture angles.
 * The camera sees you from the side, so we use whichever side (left/right)
 * the camera can see better.
 * For side-view detection
 */
// export function computeAngles(
//   landmarks: NormalizedLandmark[] | undefined,
//   width: number,
//   height: number,
// ): Angles | null {
//   if (!landmarks || landmarks.length < 25) return null //the highest position is the hip landmark at 24; must have at least 25 entries (index 0-24)

//   const score = (ear: number, shoulder: number, hip: number) => //sums the visibility of each landmark for each side (left, right)
//     (landmarks[ear].visibility ?? 0) +
//     (landmarks[shoulder].visibility ?? 0) +
//     (landmarks[hip].visibility ?? 0)

//     /**
//      * MediaPipe doesn’t leave hidden landmarks out. It always returns all 33 points, and when a body part is hidden or occluded, it guesses the position and gives it a
//      * low visibility score. So the array always has entries for both sides, and visibility tells you how trustworthy each one is.
//      */
//   const useLeft = //true if left sum is at least as large as score (used if one half of your body is hidden from the camera), else use right landmarks
//     score(LM.leftEar, LM.leftShoulder, LM.leftHip) >=
//     score(LM.rightEar, LM.rightShoulder, LM.rightHip)

//   const ear = landmarks[useLeft ? LM.leftEar : LM.rightEar]
//   const shoulder = landmarks[useLeft ? LM.leftShoulder : LM.rightShoulder]
//   const hip = landmarks[useLeft ? LM.leftHip : LM.rightHip]

//   if (!visible(ear) || !visible(shoulder)) return null

//   return {
//     side: useLeft ? 'left' : 'right',
//     neck: angleFromVertical(shoulder, ear, width, height),
//     // Hips are often hidden behind the desk; that's fine, we fall back to neck only.
//     torso: visible(hip) ? angleFromVertical(hip, shoulder, width, height) : null,
//   }
// }

export type PostureStatus = 'uncalibrated' | 'calibrating' | 'good' | 'bad' | 'no_person'
export type PostureEvent = 'became_bad' | 'became_good' | 'jumpscare'

type Baseline = Angles

/*For face-view detection */
export function computeAngles(
  landmarks: NormalizedLandmark[] | undefined,
  width: number,
  height: number,
): Angles | null {
  if (!landmarks || landmarks.length < 13) return null

  const nose = landmarks[LM.nose]
  const lEar = landmarks[LM.leftEar]
  const rEar = landmarks[LM.rightEar]
  const lSh = landmarks[LM.leftShoulder]
  const rSh = landmarks[LM.rightShoulder]

  // Front view needs both sides visible.
  if (![nose, lEar, rEar, lSh, rSh].every(visible)) return null

  // Pixel units so a wide video doesn't distort distances.
  const dist = (a: NormalizedLandmark, b: NormalizedLandmark) =>
    Math.hypot((a.x - b.x) * width, (a.y - b.y) * height)

  const shoulderW = dist(lSh, rSh)
  if (shoulderW < 1) return null

  const shoulderMidY = ((lSh.y + rSh.y) / 2) * height

  return {
    face: dist(lEar, rEar) / shoulderW,
    neck: (shoulderMidY - nose.y * height) / shoulderW,
    tilt: (Math.abs(lSh.y - rSh.y) * height) / shoulderW,
  }
}

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
  /*For side-view detection */
  // isSlouchedFrame(a: Angles): boolean {
  //   if (!this.baseline) return false
  //   const neckBad = a.neck > this.baseline.neck + CONFIG.neckToleranceDeg
  //   const torsoBad =
  //     a.torso !== null &&
  //     this.baseline.torso !== null &&
  //     a.torso > this.baseline.torso + CONFIG.torsoToleranceDeg
  //   return neckBad || torsoBad
  // }

  /*For front-view detection */
  isSlouchedFrame(a: Angles): boolean {
    const b = this.baseline
    if (!b) return false
    const headForward = a.face > b.face * (1 + CONFIG.faceGrowth)
    const headDrop = a.neck < b.neck * (1 - CONFIG.neckDrop)
    const leaning = a.tilt > b.tilt + CONFIG.tiltTolerance
    return headForward || headDrop || leaning
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
  /*side-view detection */
  // const neck = samples.reduce((s, a) => s + a.neck, 0) / samples.length
  // const torsos = samples.map((a) => a.torso).filter((t): t is number => t !== null)
  // // Only trust torso if hips were visible in most calibration frames.
  // const torso =
  //   torsos.length >= samples.length * 0.6
  //     ? torsos.reduce((s, t) => s + t, 0) / torsos.length
  //     : null
  // return { neck, torso }

  /* front-view detection */
  const avg = (pick: (a: Angles) => number) =>
    samples.reduce((s, a) => s + pick(a), 0) / samples.length
  return { face: avg((a) => a.face), neck: avg((a) => a.neck), tilt: avg((a) => a.tilt) }

}

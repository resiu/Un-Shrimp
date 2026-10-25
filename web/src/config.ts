// All the knobs you'll want to tune at the hackathon live here.
// Change a number, save, and Vite hot-reloads the app.

export const CONFIG = {
  /*For side-view detection */
  // How many degrees WORSE than your calibrated "good" posture counts as slouching.
  // neckToleranceDeg: 6, // ear-over-shoulder angle (head jutting forward)
  // torsoToleranceDeg: 4, // shoulder-over-hip angle (leaning/hunching). Only used if hips are visible.

  /*For front-view detection : how far from your calibrated posture counts as slouching*/
  // lower number higher sensitivity
  faceGrowth: 0.08,    // head moves toward camera: ear-to-ear width grows 12%+ vs. shoulder width
  neckDrop: 0.08,      // head sinks toward shoulders: nose-to-shoulder gap shrinks 15%+
  tiltTolerance: 0.03, // one shoulder lower than the other (as a

  // How long you must be slouching before we react (avoids false alarms
  // when you reach for a drink).
  badHoldMs: 2000,
  // How long you must sit up straight before we calm down.
  goodHoldMs: 1000,

  // After the screen jumpscare fires, wait this long before it can fire again.
  jumpscareCooldownMs: 20000,
  // If you STAY slouched this long after slouching is detected, escalate to the jumpscare.
  jumpscareAfterBadMs: 3000,

  // Still slouching after a roast? Roast again this often, one shrimp level higher each time
  // (human voice -> full underwater shrimp). Sitting up resets to the human voice.
  roastRepeatMs: 15000,

  // Landmarks with visibility below this are ignored.
  minVisibility: 0.5,

  // Detection runs this often (ms). 100ms = 10 times per second, plenty for posture.
  detectIntervalMs: 100,

  // Calibration averages this many frames of "good" posture.
  calibrationFrames: 30,

  // Pose model. "lite" is fastest; swap "lite" for "full" in both places if detection is shaky.
  modelUrl:
    'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
} as const

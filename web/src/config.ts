// All the knobs you'll want to tune at the hackathon live here.
// Change a number, save, and Vite hot-reloads the app.

export const CONFIG = {
  // How many degrees WORSE than your calibrated "good" posture counts as slouching.
  neckToleranceDeg: 12, // ear-over-shoulder angle (head jutting forward)
  torsoToleranceDeg: 8, // shoulder-over-hip angle (leaning/hunching). Only used if hips are visible.

  // How long you must be slouching before we react (avoids false alarms
  // when you reach for a drink).
  badHoldMs: 3000,
  // How long you must sit up straight before we calm down.
  goodHoldMs: 1000,

  // After the screen jumpscare fires, wait this long before it can fire again.
  jumpscareCooldownMs: 20000,
  // If you STAY slouched this long after the robot gets angry, escalate to the jumpscare.
  jumpscareAfterBadMs: 4000,

  // Landmarks with visibility below this are ignored.
  minVisibility: 0.5,

  // Detection runs this often (ms). 100ms = 10 times per second, plenty for posture.
  detectIntervalMs: 100,

  // Calibration averages this many frames of "good" posture.
  calibrationFrames: 30,

  // Arduino serial baud rate. MUST match Serial.begin() in the .ino file.
  baudRate: 9600,

  // Pose model. "lite" is fastest; swap "lite" for "full" in both places if detection is shaky.
  modelUrl:
    'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
} as const

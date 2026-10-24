# Posture Bot 👹🪑

A grumpy steampunk plush that watches you from the side and gets **angry** when you slouch.
Built at SBUHacks 2026 ("Steel and Steam").

```
[USB webcam inside the plush, side view]
              │
              ▼
[Laptop: Chrome web app]
   - MediaPipe Pose finds your ear, shoulder, hip
   - Measures how far your head/torso lean vs. YOUR calibrated good posture
   - Slouch for 3 s  → robot gets angry
   - Still slouching → full-screen jumpscare
              │  USB serial: "G" / "B" / "J"
              ▼
[Arduino: eyebrow servos + buzzer + LEDs]
```

## Repo layout

```
arduino/posture_bot/posture_bot.ino   Arduino sketch (servos, buzzer, LEDs)
web/                                  React + TypeScript + Vite app
  src/config.ts                       ⭐ all tunable numbers (thresholds, timings)
  src/lib/posture.ts                  angle math + calibration + slouch timer
  src/lib/pose.ts                     loads the MediaPipe pose model
  src/lib/serial.ts                   talks to the Arduino (Web Serial)
  src/lib/sound.ts                    jumpscare screech (generated, no file needed)
  src/components/Jumpscare.tsx        full-screen jumpscare
  src/App.tsx                         the page + main loop
docs/TASKS.md                         who does what + milestones
```

## Setup (Windows)

Install once: [Node.js LTS](https://nodejs.org), [Git](https://git-scm.com), [Arduino IDE 2](https://www.arduino.cc/en/software), and use **Chrome or Edge** (Web Serial doesn't work in Firefox/Safari).

### Run the web app

```bash
git clone <this repo url>
cd posture-bot/web
npm install
npm run dev
```

Open **http://localhost:5173** in Chrome. Then:

1. Pick the USB webcam in the dropdown → **Start camera** (allow camera access).
2. **Connect robot** → choose the Arduino's COM port.
3. Sit up straight → **Calibrate**. Hold still ~3 seconds.
4. Slouch. 😈

The **Test the robot** buttons send G/B/J without needing the camera — great for hardware testing.

> Camera and serial only work on `localhost` (or HTTPS). Opening the app from another laptop by IP address won't work; each laptop runs its own `npm run dev`.

### Upload the Arduino sketch

1. Open `arduino/posture_bot/posture_bot.ino` in Arduino IDE.
2. Tools → Board → your board (e.g. Arduino Uno); Tools → Port → the COM port.
3. Upload. Open Serial Monitor (9600 baud, "Newline"), you should see `READY`. Type `B`, `G`, `J` to test.
4. **Close the Serial Monitor** before clicking "Connect robot" in the web app. Only one program can hold the COM port.

## Camera placement tips

- Put the camera to your **side**, roughly **shoulder height**, about 1–1.5 m away.
- It must see your **ear and shoulder**. Hips are a bonus (they're often hidden by the desk; the app falls back to neck-only).
- Light your face/side; don't sit with a bright window behind you.
- Re-calibrate whenever the camera or chair moves.

## Tuning

Everything is in `web/src/config.ts`. Most likely changes:

| Problem | Change |
| --- | --- |
| Triggers when you're sitting fine | raise `neckToleranceDeg` |
| Doesn't notice obvious slouching | lower `neckToleranceDeg` |
| Too twitchy | raise `badHoldMs` |
| Jumpscare too often | raise `jumpscareCooldownMs` |

The **Live angles** panel shows Now / Baseline / Limit, so you can watch the numbers while you slouch.

## Known limitations (be upfront in the demo)

- Chrome slows down background tabs. Keep the app **visible** (snap it to half the screen or put it on a second monitor). If the tab is hidden, the app falls back to a system notification.
- The jumpscare only covers the browser window, not other apps.

## Built with

React, TypeScript, Vite, [MediaPipe Pose Landmarker](https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker), Web Serial API, Arduino.

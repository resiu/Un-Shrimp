# Posture Bot 👹🪑

A webcam + browser app that watches you from the side and gets **angry** when you slouch.
Built at SBUHacks 2026 ("Steel and Steam").

```
[USB webcam, side view]
              │
              ▼
[Laptop: Chrome web app]
   - MediaPipe Pose finds your ear, shoulder, hip
   - Measures how far your head/torso lean vs. YOUR calibrated good posture
   - Slouch for 3 s  → app warns you
   - Still slouching → full-screen jumpscare
```

## Repo layout

```
web/                                  React + TypeScript + Vite app
  src/config.ts                       ⭐ all tunable numbers (thresholds, timings)
  src/lib/posture.ts                  angle math + calibration + slouch timer
  src/lib/pose.ts                     loads the MediaPipe pose model
  src/lib/sound.ts                    jumpscare screech (generated, no file needed)
  src/components/Jumpscare.tsx        full-screen jumpscare
  src/App.tsx                         the page + main loop
docs/TASKS.md                         who does what + milestones
```

## Setup (Windows)

### Install these first

- [Node.js LTS](https://nodejs.org). Use the Windows installer and keep the default options.
- [Git](https://git-scm.com). Keep the default options.
- **Chrome or Edge**.
- Optional: [VS Code](https://code.visualstudio.com) for editing the code.

Open a **new** terminal (PowerShell) and check that everything installed:

```bash
node -v
npm -v
git --version
```

Each command should print a version number.

### Run the web app

```bash
git clone https://github.com/resiu/SBUHacks-2026.git
cd SBUHacks-2026/web
npm install
npm run dev
```

Open **http://localhost:5173** in Chrome. Then:

1. Pick the USB webcam in the dropdown → **Start camera** (allow camera access).
2. Sit up straight → **Calibrate**. Hold still ~3 seconds.
3. Slouch. 😈

> The camera only works on `localhost` (or HTTPS). Opening the app from another laptop by IP address won't work; each laptop runs its own `npm run dev`.

### Common problems

- **Camera isn't in the dropdown:** click **Start camera** once to grant camera permission. The list fills in after that.
- **`npm` / `node` is not recognized:** close and reopen the terminal after installing Node.js. Restart VS Code too if you're using its terminal.

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

React, TypeScript, Vite, [MediaPipe Pose Landmarker](https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker).

# Un-Shrimp (for SBUHacks 2026)

A webcam + browser app that watches you while you work and gets **angry** when you slouch.
Built at SBUHacks 2026 ("Steel and Steam").

- Calibrates to **your** good posture, then warns you the moment you start shrimping.
- Keep slouching and you get a **full-screen jumpscare** plus a spoken **roast** that slowly turns into an underwater shrimp voice.
- An optional **Arduino** on your desk glows green / yellow-orange / red and beeps along.
- Log in to track your stats and compete on **live leaderboards** (Most Shrimp 🦐, Straightest 📏, Most Improved 📈).
- A **Pomodoro timer** forces real breaks: the break clock only runs once you've walked away from the camera.
- All pose detection runs **in your browser**. No video ever leaves the laptop.

## Contents

1. [What to download](#what-to-download)
2. [Run the app](#run-the-app)
3. [Arduino setup (optional)](#arduino-setup-optional)
4. [How it works](#how-it-works)
5. [Tuning](#tuning)
6. [Working on the code](#working-on-the-code)
7. [API reference](#api-reference)
8. [Common problems](#common-problems)

---

## What to download

### Everyone

| What | Why | Get it |
| --- | --- | --- |
| **Node.js 22.18 or newer** (the LTS version) | Runs the website's dev server and the backend. The backend runs `.ts` files directly, which needs 22.18+. | [nodejs.org](https://nodejs.org). Use the Windows installer and keep the default options. |
| **Git** | Downloads the code and shares your changes. | [git-scm.com](https://git-scm.com). Keep the default options. |
| **Chrome or Edge** | The app uses Web Serial (for the Arduino), which Firefox and Safari don't have. | Already on most laptops. |
| **A webcam** | Built-in or USB. It has to see your face and both shoulders. | |

Open a **new** terminal (PowerShell) and check:

```bash
node -v      # must print v22.18.0 or higher
npm -v
git --version
```

You **don't** install any JavaScript libraries by hand. `npm install` (below) downloads everything listed in the three `package.json` files: React, Vite, MediaPipe, Express, SQLite and so on.

### Optional

| What | Why |
| --- | --- |
| [**VS Code**](https://code.visualstudio.com) | Recommended editor. |
| [**ElevenLabs**](https://elevenlabs.io) account (free tier works) | A realistic voice for the roasts. Without it, the browser's built-in voice is used. See [Voice-over roasts](#voice-over-roasts). |

### Hardware teammates (Arduino)

| What | Notes |
| --- | --- |
| **Arduino Uno** + its USB cable | Clones work too. |
| **RGB LED** (4 legs) + **3 resistors** (220–330 Ω) | One resistor per color leg. |
| **Buzzer** | Passive or active. |
| Breadboard + jumper wires | |
| **PlatformIO IDE** extension for VS Code | Builds and uploads the Arduino code. In VS Code: Extensions tab → search "PlatformIO IDE" → Install. The first time you open the `arduino/` folder it downloads the Uno tools (a few minutes). |
| **CH340 USB driver** (clone boards only) | Only if the board doesn't show up as a port when plugged in. Get it from the board seller's page. |

---

## Run the app

```bash
git clone https://github.com/resiu/SBUHacks-2026.git
cd SBUHacks-2026
npm install                                  # also installs web/ and backend/
copy backend\.env.example backend\.env       # first time only (Mac/Linux: cp)
npm run seed                                 # optional: 6 fake users for the leaderboard
npm run dev                                  # starts the website AND the backend
```

Wait until the terminal shows both lines:

```
[web]   ➜  Local:   http://localhost:5173/
[api] API + WebSocket listening on http://localhost:3001
```

Then open **http://localhost:5173** in Chrome:

1. **Sign up**, or log in as a seeded user, e.g. `shrimp_king` / `password123`.
2. Pick your webcam in the dropdown → **1. Start camera** (allow camera access).
3. Sit up straight, facing the camera → **2. Calibrate**. Hold still for about 3 seconds.
4. Optional: **Connect Arduino** (see [Arduino setup](#arduino-setup-optional)).
5. **Start Monitoring** to record your posture to your stats and the leaderboard.
6. Slouch. 😈

> Always run `npm run dev` from the **repo root**, not from `web/`. Running it in `web/` starts only the website, so login fails with "Bad Gateway".
>
> The camera only works on `localhost` (or HTTPS). Each laptop runs its own `npm run dev`, with its **own** database. For one shared leaderboard at the demo, everyone uses the same laptop.

### Camera placement

- Put the webcam **in front of you**, at about eye or screen level (on top of the monitor is perfect).
- It must clearly see your **nose, both ears and both shoulders**. If one ear is hidden (head turned, hair, headphones), the app shows "Can't see you".
- Light your face; don't sit with a bright window behind you.
- **Re-calibrate** whenever the camera, chair or your distance to the screen changes.

---

## Arduino setup (optional)

An Arduino Uno plugged into the laptop shows your posture on your desk:

| Your posture | LED | Buzzer |
| --- | --- | --- |
| Good | 🟢 green | – |
| Slouching | 🟠 yellow-orange | – |
| Jumpscare fired | 🔴 red, **stays red until you sit up** | one short beep (~200 ms) |
| Not calibrated yet | off | – |

### 1. Wire it

| Part | Arduino pin |
| --- | --- |
| LED **red** leg (through a resistor) | **D9** |
| LED **green** leg (through a resistor) | **D10** |
| LED **blue** leg (through a resistor) | **D11** |
| LED **common** (longest) leg | **GND** (common cathode) or **5V** (common anode, see below) |
| Buzzer **+** | **D2** |
| Buzzer **−** | **GND** |

D9–D11 are **PWM** pins, which can dim. That's what makes the yellow-orange mix possible; A0–A5 can only switch fully on or off.

- **Colors inverted** (green when it should be off, etc.)? Your LED is common-anode: set `COMMON_ANODE = true` at the top of `arduino/src/main.cpp`.
- **Colors swapped** (e.g. red shows as green)? Swap the pin numbers `RED_PIN` / `GREEN_PIN` / `BLUE_PIN` at the top of `main.cpp`.

### 2. Upload the program

1. Install the **PlatformIO IDE** extension in VS Code (see [What to download](#hardware-teammates-arduino)).
2. Open the **`arduino` folder itself** in VS Code: *File → Open Folder* → select `arduino` → *Select Folder*.
   PlatformIO only switches on when the opened folder contains `platformio.ini`, so opening `posture-bot` or `arduino/src` won't show its buttons.
   *Want one window?* In your `posture-bot` window use *File → Add Folder to Workspace* → `arduino`, then *File → Save Workspace As…* (save it outside the repo).
3. Plug in the Uno. Check that the bottom bar says **`env:uno`**. `env:buzzer_test` is a separate test program that just beeps D2 and blinks the built-in LED.
4. Click **→ (Upload)** in the bottom bar.

### 3. Test it without the web app

Open PlatformIO's **Serial Monitor** (plug icon in the bottom bar), set **9600 baud** and line ending **LF**, then type each line and press Enter:

| Type | You should see |
| --- | --- |
| `20` | green |
| `70` | yellow-orange |
| `J` | red + one beep |
| `J` | still red, **no** beep |
| `70` | still red |
| `20` | green |
| `O` | off |
| `abc` | nothing (ignored) |

### 4. Connect the web app

1. **Close the Serial Monitor.** Only one program can use the Uno's port at a time.
2. In the web app, click **Connect Arduino** and pick the Uno. It's usually listed as "USB Serial Device (COMx)"; ports described as "Bluetooth" are not the Uno.
3. Wait about 2 seconds (the Uno restarts when the app connects), then Start camera → Calibrate.

**Only one program can hold the port.** Upload or Serial Monitor needs the web app disconnected (close or refresh its tab). Connect Arduino needs the Serial Monitor closed. "Access is denied" or "port busy" means the other one still has it.

**LED does nothing after connecting?** The Uno is probably still running an old program. Disconnect the web app, upload again, reconnect.

---

## How it works

### The big picture

```
 Webcam ─► App.tsx (browser, 10×/s)
             │  MediaPipe Pose: 33 body points
             │  computeAngles():   3 measurements (face, neck, tilt)
             │  PostureMonitor:    good / bad / jumpscare decisions
             │
             ├─► Screen:   status badge, live table, jumpscare overlay + screech
             ├─► Voice:    POST /api/roast ─► backend ─► ElevenLabs ─► MP3 ─► shrimp effects
             ├─► Arduino:  shrimp score 5×/s + "J" ─► USB (Web Serial) ─► LED + buzzer
             └─► ProfilePage (onFrame)
                   │  every 5 s while monitoring
                   └─► POST /api/posture ─► backend saves it (SQLite)
                                              └─► WebSocket ─► live stats + leaderboards
```

Vite (port 5173) forwards `/api` and `/ws` to the backend (port 3001), so the browser only ever talks to 5173.

### 1. Seeing you: pose detection

`web/src/lib/pose.ts` loads Google's **MediaPipe Pose Landmarker** ("lite" model). Its WebAssembly files are copied into `web/public/mediapipe/` by `npm run dev`, so nothing loads from a CDN except the model file. It tries the graphics card first and falls back to the CPU.

Every **100 ms** (`detectIntervalMs`), the main loop in `App.tsx` hands the current video frame to MediaPipe. It returns 33 points on your body and draws the skeleton over the video.

### 2. Measuring posture: three numbers

`computeAngles()` in `web/src/lib/posture.ts` needs your **nose, both ears and both shoulders** clearly visible (`minVisibility`). Otherwise the frame counts as "Can't see you". It turns those points into three numbers, each **divided by your shoulder width**, so leaning closer to or further from the camera doesn't change them:

| Measurement | What it is | Slouching makes it… |
| --- | --- | --- |
| **Head size** (`face`) | distance between your ears | **bigger**: your head moves toward the camera |
| **Neck gap** (`neck`) | height from the shoulder line up to your nose | **smaller**: your head sinks into your shoulders |
| **Shoulder tilt** (`tilt`) | height difference between your two shoulders | **bigger**: you lean to one side |

The **Live Posture Angles** panel shows each one: **Now**, your **Base** (calibrated), and the **Limit** where it counts as slouching.

### 3. Your posture, not a textbook's: calibration

Clicking **Calibrate** averages your three numbers over **30 frames** (`calibrationFrames`, about 3 s) while you sit up straight. That average is your **baseline**. A single frame counts as slouched if **any** measurement passes its limit:

- Head size grows more than **`faceGrowth`** (8 %) above baseline, **or**
- Neck gap shrinks more than **`neckDrop`** (8 %) below baseline, **or**
- Shoulder tilt rises more than **`tiltTolerance`** (0.03) above baseline.

### 4. Calm decisions: the posture state machine

Single frames are noisy (reaching for a drink, a sneeze), so `PostureMonitor` waits before reacting:

```
            slouched for badHoldMs (2 s)                 still slouched jumpscareAfterBadMs (3 s)
  GOOD ─────────────────────────────────────► SLOUCHING ───────────────────────────────────────► JUMPSCARE
    ▲                                              │       (at most once per jumpscareCooldownMs, 20 s)
    └────────── sat up straight for goodHoldMs (1 s) ┘
```

If you leave the frame while slouching, it stays SLOUCHING. It never punishes you for walking away.

### 5. The reactions

| When | What happens | Code |
| --- | --- | --- |
| Slouching | the status badge turns red ("SLOUCHING!") | `App.tsx`, `dashboard.css` |
| Jumpscare | full-screen angry face for 1.5 s + generated screech, plus a system notification if the tab is hidden | `components/Jumpscare.tsx`, `lib/sound.ts` |
| Jumpscare | a spoken **roast** right after the screech | `lib/roast.ts` |
| Still slouching | another roast every 15 s (`roastRepeatMs`), each **shrimpier**: higher, muffled, wobbly, bubbly. Sitting up resets to a human voice | `lib/roast.ts` |
| Always | Arduino LED + buzzer | `lib/arduino.ts` |

### 6. The score

`web/src/lib/reading.ts` turns a frame into a **posture score from 0 to 100**:

- It measures how far each of the three numbers is past baseline, in units of "thresholds" (1 = exactly at the limit), and takes the **worst** one.
- `score = 100 − 50 × worst` (clamped), so **100** = your calibrated posture, **50** = exactly at the slouch limit, **0** = twice past it.

The same score feeds the leaderboard readings and, flipped into a **shrimp score** (`100 − score`, higher = more slouched), the Arduino.

### 7. Voice-over roasts

1. The browser asks the backend for a roast (`POST /api/roast`).
2. The backend picks the next line from your personal **shuffled deck** of `backend/src/roasts.ts` (every line plays once before any repeats), voices it with **ElevenLabs**, and caches the MP3 so each line is paid for only once per server run.
3. The browser plays it through Web Audio effects from the `LEVELS` table in `lib/roast.ts`:

   | Shrimp level | Sound |
   | --- | --- |
   | 0 | the normal ElevenLabs voice |
   | 1 | a bit higher, slightly muffled |
   | 2 | high, underwater, wobbly, a few bubbles |
   | 3 | very squeaky, heavy underwater, lots of bubbles |

4. No ElevenLabs key, or it's down? The browser's built-in voice reads the same line, with pitch and bubbles per level.

Every roast prints a `[roast]` line in the browser console (F12) saying what played or why it was skipped.

### 8. The Arduino link

`web/src/lib/arduino.ts` uses Chrome's **Web Serial** to talk to the Uno at **9600 baud**. It sends one line of text at a time, each ending in `\n`:

| Line | When | Arduino (`arduino/src/main.cpp`) |
| --- | --- | --- |
| `0`–`100` (e.g. `37`) | about 5× a second (`arduinoSendMs`) | the **shrimp score**: below `SLOUCH_THRESHOLD` (50) → green, at or above → yellow-orange |
| `J` | once per jumpscare | red + one beep. Stays red until a score below 50 arrives. A repeated `J` while red doesn't beep |
| `O` | before calibrating / while recalibrating | LED off |

Anything else is ignored. While you're out of frame nothing is sent, so the LED keeps its last color.

The threshold 50 is the same line the app uses: the score is exactly 50 at the `config.ts` limits. So `SLOUCH_THRESHOLD` in the sketch and `SLOUCH_SCORE` in `arduino.ts` must stay 50 unless the score formula changes. Unlike the on-screen badge, the LED has no 2-second hold: it reacts immediately.

### 9. Accounts, stats and live leaderboards

- **Login:** passwords are hashed with Node's built-in **scrypt** plus a random salt (never stored in plain text) and checked with a constant-time comparison. Logging in returns a **JWT** token (valid 7 days) that the browser keeps in `localStorage` and sends with every request.
- **Monitoring:** **Start Monitoring** creates a *session*. Every 5 s the latest frame becomes a *reading* `{ neckAngle, shoulderAngle, slouching, score }` saved in `backend/posture.db` (SQLite). Readings are skipped while calibrating or out of frame. (`neckAngle` / `shoulderAngle` carry the front-view neck gap and shoulder tilt; the names are left over from an earlier side-view version.)
- **Your stats:** average score, % of readings spent slouching, number of readings and sessions, and **improvement** = first session's slouch % minus your latest one.
- **Leaderboards** (top 10 each): **Most Shrimp** = highest slouch %, **Straightest** = lowest slouch % (10+ readings), **Most Improved** = biggest drop in slouch % from first to latest session (2+ sessions).
- **Live updates:** after each reading the backend pushes your new stats to you, and the leaderboard to everyone (at most once every 2 s), over a **WebSocket**. Pages update without refreshing.

### 10. Pomodoro breaks

Click **🍅** (bottom-right) to start a focus timer (default 25 min) followed by a break (default 5 min).

- During a **break** every page is locked to the **Leaderboard**, with a banner showing the camera.
- The break clock **only runs while you're out of the camera's view** (after `awayGraceMs`, 2 s), so you actually have to get up. If the camera can't run, the clock pauses.
- The timer is saved in `localStorage`, so refreshing the page can't skip a break. Breaks can't be stopped early.

Code: `web/src/pomodoro/PomodoroContext.tsx`, `components/PomodoroButton.tsx`, `components/BreakBanner.tsx`.

### 11. The animated ocean

The background is drawn live in `web/src/components/OceanBackground.tsx` on a tiny canvas (1/5 of the screen), then scaled up with crisp square pixels to match the pixel-art assets:

- water bands with light rays and ripples;
- swaying seaweed and coral at three depths;
- colorful pixel fish (some in schools);
- rising bubbles you can **pop with the mouse**, with a soft pop sound.

It runs at 20 fps to leave CPU for pose detection, pauses when the tab is hidden, and shows a still frame if your system asks for reduced motion. Colors live in `web/src/ocean.css`.

---

## Tuning

Almost everything is a number in **`web/src/config.ts`**. Save the file and the app reloads.

| Problem | Change |
| --- | --- |
| Triggers when you're sitting fine | raise `faceGrowth`, `neckDrop` and/or `tiltTolerance` |
| Doesn't notice obvious slouching | lower them |
| Too twitchy | raise `badHoldMs` |
| Jumpscare too often | raise `jumpscareCooldownMs` |
| Jumpscare too soon after the warning | raise `jumpscareAfterBadMs` |
| Roasts too frequent while slouching | raise `roastRepeatMs` |
| Laptop struggling | raise `detectIntervalMs` (fewer checks per second) |
| Pomodoro defaults | `pomodoroWorkMin`, `pomodoroBreakMin`, `awayGraceMs` |

Watch the **Live Posture Angles** panel (Now / Base / Limit) while you slouch to see which measurement trips first.

Other knobs:

- **Roast lines:** `backend/src/roasts.ts`.
- **Shrimp voice:** the `LEVELS` table in `web/src/lib/roast.ts`.
- **Ocean:** colors in `web/src/ocean.css`; fish and bubble counts in `buildScene()` in `OceanBackground.tsx`; `pixelSize` / `speed` in `AppRoutes.tsx`.
- **LED colors and beep:** top of `arduino/src/main.cpp`.

---

## Working on the code

### Repo layout

```
package.json                    root: `npm run dev` starts web + backend together
web/                            React + TypeScript + Vite website
  src/config.ts                 ⭐ all tunable numbers
  src/App.tsx                   the detector: camera, skeleton, main loop, reactions
  src/AppRoutes.tsx             which page shows at which URL (+ ocean, Pomodoro lock)
  src/pages/                    Login, Leaderboard, Profile ("Shrimp Stats")
  src/components/               Jumpscare, NavBar, OceanBackground, Pomodoro button + break banner, ShrimpIcon
  src/lib/pose.ts               loads the MediaPipe pose model
  src/lib/posture.ts            the 3 measurements + calibration + state machine
  src/lib/reading.ts            frame → 0–100 score
  src/lib/roast.ts              plays roasts + shrimp voice effects
  src/lib/sound.ts              screech + bubble pop (generated, no files)
  src/lib/arduino.ts            Web Serial link to the Uno
  src/pomodoro/                 Pomodoro timer state
  src/api/                      all backend calls (http.ts) + live updates (socket.ts)
  src/auth/                     who's logged in + redirect to /login
  src/*.css                     styles.css (base), dashboard.css, pages.css, ocean.css
backend/                        Node + Express + WebSocket + SQLite (port 3001)
  src/server.ts                 starts everything
  src/routes/                   one file per API endpoint group
  src/scoring.ts                stats + leaderboard math
  src/ws.ts                     live updates
  src/roasts.ts                 the roast lines
  src/seed.ts                   fake demo users
  .env.example                  copy to .env (secrets, ElevenLabs key)
arduino/                        PlatformIO project for the Uno (RGB LED + buzzer)
docs/TASKS.md                   who does what + milestones
```

### Who owns what

| Folder | Owner | Notes |
| --- | --- | --- |
| `web/src/pages/`, `web/src/components/NavBar.tsx`, `web/src/pages.css` | **Frontend / design** | Restyle freely. |
| `web/src/api/`, `web/src/auth/`, `web/src/AppRoutes.tsx` | **Frontend logic** | Change carefully; every page depends on these. |
| `web/src/App.tsx`, `web/src/lib/`, `web/src/config.ts` | **Detection** | The posture detector. Tune numbers in `config.ts`. |
| `backend/` | **Backend** | API, WebSocket, database, scoring. |
| `arduino/` | **Hardware** | Keep the serial protocol in sync with `web/src/lib/arduino.ts`. |

### What designers can safely restyle

- ✅ Anything in `web/src/pages/*.tsx` markup, `NavBar.tsx`, and `web/src/pages.css`: layout, wording, colors (use the CSS variables), emoji, extra visuals.
- ❌ Leave alone: `web/src/api/`, `web/src/auth/`, the detection code (`App.tsx`, `lib/`), and the data flow in `ProfilePage.tsx` (the `onFrame`, Start/Stop Monitoring, and 5-second reading logic). When you prompt your AI, tell it: *"only change JSX and CSS, keep every hook, handler and import."*

### Useful commands (from the repo root)

- `npm run dev`: website + backend together (the backend restarts when you save a file).
- `npm run seed`: re-creates the 6 fake users (password `password123`). Doesn't touch real accounts.
- To wipe all data, stop the server and delete `backend/posture.db*`.
- `npm run build --prefix web`: checks the website compiles.
- `npm run typecheck --prefix backend`: checks backend types (optional; Node itself ignores types).

### Voice-over roasts

- **Edit the lines** in `backend/src/roasts.ts` (one list; save and the backend restarts).
- **Turn on the ElevenLabs voice:**
  1. Create a free account at [elevenlabs.io](https://elevenlabs.io) → **Developers → API Keys** → **Create API Key** (Text to Speech permission is enough). Copy it right away; it's only shown once.
  2. Paste it into `backend/.env` after `ELEVENLABS_API_KEY=` (no quotes, no spaces). **Never commit it or put it in `web/`.**
  3. Optional: pick a voice in their Voice Library and paste its ID after `ELEVENLABS_VOICE_ID=`.
  4. Restart `npm run dev`.
- Each line is generated once per server run and then reused, so a few dozen lines cost very little of the free tier.

---

## API reference

### REST

All bodies are JSON. 🔒 = needs `Authorization: Bearer <token>`. Errors look like `{ "error": "message" }`.

| Method & path | Body | Response |
| --- | --- | --- |
| `POST /api/signup` | `{ username, password }` | `{ token, user: { id, username } }` |
| `POST /api/login` | `{ username, password }` | `{ token, user: { id, username } }` |
| 🔒 `GET /api/me` | | `{ username, avgScore, slouchPct, totalReadings, sessions, improvement }` |
| 🔒 `POST /api/sessions` | | `{ sessionId }` (call when monitoring starts) |
| 🔒 `POST /api/posture` | `{ sessionId, neckAngle, shoulderAngle, slouching, score }` | `{ ok: true }` |
| `GET /api/leaderboard` | | `{ shrimpiest, straightest, mostImproved }` |
| 🔒 `POST /api/roast` | | MP3 audio (line in the `X-Roast-Text` header), or `503 { error, text }` when there's no ElevenLabs voice |

- `avgScore`, `slouchPct` and `improvement` are `null` until there's data. `slouchPct` is 0–100.
- `improvement` = first session's slouch % minus latest session's (positive = better). Needs 2+ sessions.
- Leaderboard (top 10 each): `shrimpiest` and `straightest` entries are `{ username, slouchPct, totalReadings }`, with `straightest` needing 10+ readings. `mostImproved` entries are `{ username, improvement, firstSlouchPct, latestSlouchPct }`, with 2+ sessions.

### WebSocket

Connect to `/ws?token=<token>` (done for you by `web/src/api/socket.ts`, which reconnects automatically). The server only sends; messages are JSON:

```js
{ type: "leaderboard", data: { shrimpiest, straightest, mostImproved } } // to everyone, at most every 2 s
{ type: "myStats",     data: { username, avgScore, slouchPct, ... } }     // to you, after each of your readings
```

An invalid token closes the socket with code `4001`. In a page, listen with:

```ts
useEffect(() => onSocketMessage((msg) => { if (msg.type === 'myStats') setStats(msg.data) }), [])
```

---

## Common problems

| Problem | Fix |
| --- | --- |
| `npm` / `node` is not recognized | Close and reopen the terminal after installing Node.js. Restart VS Code too if you use its terminal. |
| Login fails / "Bad Gateway" / "Can't reach the server" | The backend isn't running. Run `npm run dev` from the **repo root** and look for the `[api] … listening` line. |
| "Missing JWT_SECRET" | You skipped the `copy backend\.env.example backend\.env` step. |
| Camera isn't in the dropdown | Click **Start camera** once to grant permission; the list fills in after that. |
| "Can't see you" while sitting there | The camera needs your nose, both ears and both shoulders. Face it, improve lighting, re-calibrate. |
| No roast voice / sound | Click something on the page first (browsers block sound until you do). Check the `[roast]` line in the console (F12). |
| Roast uses the robot voice | No ElevenLabs key, or it failed. The reason is in the `[api]` terminal output. |
| Arduino: "Access is denied" / port busy | Another program has the port: close the Serial Monitor, or close/refresh the web app tab. |
| Arduino: no port shows up | Try another USB cable (some are charge-only). Clone boards may need the CH340 driver. |
| Arduino: LED does nothing | Re-upload the program (`env:uno`), then Connect Arduino again. |
| Leaderboard doesn't match a teammate's | Each laptop has its own database. Use one laptop for the demo. |

### Known limitations (be upfront in the demo)

- Chrome slows down background tabs. Keep the app **visible** (snap it to half the screen or put it on a second monitor). If the tab is hidden, the jumpscare falls back to a system notification.
- The jumpscare only covers the browser window, not other apps.
- Web Serial (Arduino) only works in Chrome and Edge.

## Built with

React, TypeScript, Vite, React Router, [MediaPipe Pose Landmarker](https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker), Node + Express, ws (WebSocket), SQLite (better-sqlite3), ElevenLabs, PlatformIO + Arduino.

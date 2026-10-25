# Posture Bot 👹🪑

A webcam + browser app that watches you from the side and gets **angry** when you slouch.
Built at SBUHacks 2026 ("Steel and Steam").

> **Requires Node.js 22.18 or newer** (run `node -v`). The backend runs its `.ts` files directly on Node, with no build step, and older versions can't do that.

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
  src/App.tsx                         the detector: camera, skeleton, main loop
  src/AppRoutes.tsx                   which page shows at which URL
  src/pages/                          Login, Leaderboard, Profile ("Shrimp Stats")
  src/api/                            all backend calls (http.ts) + live updates (socket.ts)
  src/auth/                           who's logged in + redirect to /login
backend/                              Node + Express + WebSocket + SQLite (port 3001)
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

### Run the app

```bash
git clone https://github.com/resiu/SBUHacks-2026.git
cd SBUHacks-2026
npm install                                  # also installs web/ and backend/
copy backend\.env.example backend\.env       # first time only (Mac/Linux: cp)
npm run seed                                 # optional: 6 fake users for the leaderboard
npm run dev                                  # starts the website AND the backend
```

Open **http://localhost:5173** in Chrome. Then:

1. Sign up (or log in as a seeded user, e.g. `shrimp_king` / `password123`).
2. Pick the USB webcam in the dropdown → **Start camera** (allow camera access).
3. Sit up straight → **Calibrate**. Hold still ~3 seconds.
4. **Start Monitoring** to record your posture to your stats and the leaderboard.
5. Slouch. 😈

> The camera only works on `localhost` (or HTTPS). Opening the app from another laptop by IP address won't work; each laptop runs its own `npm run dev`.

### Common problems

- **Camera isn't in the dropdown:** click **Start camera** once to grant camera permission. The list fills in after that.
- **`npm` / `node` is not recognized:** close and reopen the terminal after installing Node.js. Restart VS Code too if you're using its terminal.
- **"Missing JWT_SECRET" / "Can't reach the server":** the backend isn't running. Make sure `backend/.env` exists (see the copy step above) and run `npm run dev` from the repo root, not from `web/`.

## Accounts, leaderboard & backend

### Who owns what

| Folder | Owner | Notes |
| --- | --- | --- |
| `web/src/pages/`, `web/src/components/NavBar.tsx`, `web/src/pages.css` | **Frontend / design** | Restyle freely. |
| `web/src/api/`, `web/src/auth/`, `web/src/AppRoutes.tsx` | **Frontend logic** | Change carefully; every page depends on these. |
| `web/src/App.tsx`, `web/src/lib/`, `web/src/config.ts` | **Detection** | The posture detector. Tune numbers in `config.ts`. |
| `backend/` | **Backend** | API, WebSocket, database, scoring. |

### What designers can safely restyle

- ✅ Anything in `web/src/pages/*.tsx` markup, `NavBar.tsx`, and `web/src/pages.css`: layout, wording, colors (use the variables in `styles.css`), emoji, extra visuals.
- ❌ Leave alone: `web/src/api/`, `web/src/auth/`, the detection code (`App.tsx`, `lib/`), and the data flow in `ProfilePage.tsx` (the `onFrame`, Start/Stop Monitoring, and 5-second reading logic). When you prompt your AI, tell it: *"only change JSX and CSS, keep every hook, handler and import."*

### How the pieces connect

```
Browser (localhost:5173)                         Backend (localhost:3001)
  App.tsx detector ──onFrame──► ProfilePage
                                  │ every 5 s while monitoring
                                  ├── POST /api/posture ──────────► saves reading (SQLite)
                                  │                                   │
  LeaderboardPage ◄── {type:"leaderboard"} ──── WebSocket /ws ◄───────┤ to everyone (max 1 per 2 s)
  ProfilePage     ◄── {type:"myStats"}     ──── WebSocket /ws ◄───────┘ to you only
```

Vite forwards `/api` and `/ws` to port 3001 (`web/vite.config.ts`), so the browser only talks to 5173.

> Each laptop running `npm run dev` has its **own** database. For one shared leaderboard at the demo, everyone uses the same laptop.

### Reading values

`ProfilePage` turns each detector frame into a reading (`web/src/lib/reading.ts`), reusing the thresholds in `config.ts`:

- `neckAngle`: nose-to-shoulder gap. `shoulderAngle`: how much one shoulder is lower than the other. Both are ratios of your shoulder width from the front-view detector, not degrees (the names are left over from the side view).
- `slouching`: the detector's own decision (badge says SLOUCHING, after `badHoldMs`).
- `score`: 100 at your calibrated posture, 50 right at the slouch threshold, 0 at twice the threshold.

Readings are skipped while calibrating or when nobody is in frame.

### REST API

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

### Backend commands (run from the repo root)

- `npm run dev`: website + backend together (backend restarts when you save a file).
- `npm run seed`: re-creates the 6 fake users (password `password123`). Doesn't touch real accounts.
- To wipe all data, stop the server and delete `backend/posture.db*`.
- `npm run typecheck --prefix backend`: checks backend types (optional; Node itself ignores types).

### Voice-over roasts (ElevenLabs)

When the jumpscare fires, the app also plays a spoken roast right after the screech, in a normal human voice. **Keep slouching and it turns into a shrimp:** another roast plays every `roastRepeatMs` (15 s, in `config.ts`), each one higher-pitched, more muffled and wobbly, with more bubbles, until it sounds like a shrimp underwater. Sit up and the next roast is human again.

- **Edit the lines** in `backend/src/roasts.ts` (one list; save and the backend restarts). Each user hears every line once, in shuffled order, before any repeats.
- **Tune the shrimp voice** in the `LEVELS` table at the top of `web/src/lib/roast.ts` (one row per level: pitch, underwater filter, wobble, bubbles). Add or remove rows to change how many steps it takes.
- **Something not playing?** Open the browser console (F12). Every roast prints a `[roast]` line saying what played, or why it was skipped.
- **Turn on the ElevenLabs voice:**
  1. Create a free account at [elevenlabs.io](https://elevenlabs.io) → Profile → **API Keys** → create a key.
  2. Paste it into `backend/.env` after `ELEVENLABS_API_KEY=` (no quotes, no spaces). **Never commit it or put it in `web/`.**
  3. Optional: pick a voice in their Voice Library and paste its ID after `ELEVENLABS_VOICE_ID=`.
  4. Restart `npm run dev`.
- **No key, or ElevenLabs is down / out of credits?** The browser reads the same line with its built-in voice, so the demo never goes silent. The reason is printed in the `[api]` terminal output.
- Each line is generated once per server run and then reused, so 10 lines cost at most 10 generations. The jumpscare's `jumpscareCooldownMs` (in `config.ts`) also limits how often roasts play.
- How it fits together: `App.tsx` (jumpscare) → `web/src/lib/roast.ts` → `POST /api/roast` → `backend/src/routes/roast.ts` → ElevenLabs.

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

React, TypeScript, Vite, React Router, [MediaPipe Pose Landmarker](https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker), Node + Express, ws (WebSocket), SQLite (better-sqlite3).

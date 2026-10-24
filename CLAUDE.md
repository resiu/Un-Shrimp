# CLAUDE.md

Rules for agentic coding tools in this repository.

## Core Principle: Minimal, Localized Changes

Make the smallest possible change that satisfies the request. Nothing more.

NEVER:
- Modify files outside the explicit scope of the request
- Refactor, rename, reformat, or clean up adjacent code
- Expand scope silently — if a request implies broader changes, ask first
- Write code before describing the plan and getting a go-ahead

HIGH BLAST-RADIUS FILES (do not modify without explicit permission):
- `web/src/App.tsx`, `web/src/main.tsx`, `web/src/styles.css`
- `web/src/lib/serial.ts` and `arduino/posture_bot/posture_bot.ino` — together they define the G/B/J serial protocol; changing one without the other breaks the robot
- `web/package.json`, `web/package-lock.json`, `web/vite.config.ts`, `web/tsconfig*.json`

## App Overview

Posture Bot (SBUHacks 2026). A side-mounted webcam watches the user; the browser app detects slouching with MediaPipe Pose and sends single-letter commands over USB serial to an Arduino plush robot (eyebrow servos, buzzer, LEDs).

- `web/` — React + TypeScript + Vite, plain CSS. Runs in Chrome/Edge (Web Serial).
- `arduino/` — Arduino sketch.
- Tunable numbers live in `web/src/config.ts`. Prefer changing config over changing logic.

## Stack

React, TypeScript, Vite, @mediapipe/tasks-vision, Web Serial API, Arduino (Servo.h).
The stack is locked. Do NOT install or suggest new packages without explicit approval.

## Standards

- Styles: use the CSS variables in `web/src/styles.css`; no hardcoded colors or inline `style={{}}` in components (SVG artwork in `Jumpscare.tsx` is exempt).
- Serial protocol: laptop sends `G`, `B`, or `J` followed by newline. Do not add commands without updating both sides and the README.
- If you notice a standards violation in a file you're working on, warn the user in the same response. Don't fix it unless asked.
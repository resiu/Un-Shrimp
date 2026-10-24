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
- `web/package.json`, `web/package-lock.json`, `web/vite.config.ts`, `web/tsconfig*.json`

## App Overview

Posture Bot (SBUHacks 2026). A side-mounted webcam watches the user; the browser app detects slouching with MediaPipe Pose and warns them with a status badge and a full-screen jumpscare.

- `web/` — React + TypeScript + Vite, plain CSS. Runs in Chrome/Edge.
- Tunable numbers live in `web/src/config.ts`. Prefer changing config over changing logic.

## Stack

React, TypeScript, Vite, @mediapipe/tasks-vision.
The stack is locked. Do NOT install or suggest new packages without explicit approval.

## Standards

- Styles: use the CSS variables in `web/src/styles.css`; no hardcoded colors or inline `style={{}}` in components (SVG artwork in `Jumpscare.tsx` is exempt).
- If you notice a standards violation in a file you're working on, warn the user in the same response. Don't fix it unless asked.
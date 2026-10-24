# Plan: who does what

Submissions are due on Devpost **Sunday 9:00 AM**. Judging starts 10:30 AM in SAC Ballroom A.

## Roles

Rename these to real people.

**Software lead (web app + integration + pitch)**
- [ ] Get `npm run dev` working on every laptop
- [ ] Test pose detection from the side with the real webcam; tune `config.ts`
- [ ] End-to-end test: slouch → SLOUCHING badge → jumpscare
- [ ] Devpost write-up, demo script

**First-timer (floater)**
- [ ] Help whoever is blocked
- [ ] Take photos/video of the build all weekend (Devpost needs them)
- [ ] Own one stretch goal below

## Milestones

| When | Goal |
| --- | --- |
| **Fri ~2 AM** | Everyone has the repo running. Skeleton shows on the webcam. |
| **Sat 12 PM** | ⭐ End-to-end works on a desk: slouch → SLOUCHING badge → jumpscare. |
| **Sat 6 PM** | Thresholds tuned on at least 2 teammates. |
| **Sat 11 PM** | Feature freeze for core. Only stretch goals and polish after this. |
| **Sun 3 AM** | Record a **backup demo video** (in case the live demo fails in the ballroom). |
| **Sun 8 AM** | Devpost submitted (don't wait for 8:59). |

## Stretch goals (only after the Sat 12 PM milestone)

- **Stats panel:** "% of time with good posture" and slouch count for the session (helps the UI/UX angle).
- **Always-on-top alerts:** Chrome's Document Picture-in-Picture or an Electron wrapper so alerts show over other apps.

## Demo script (2 min)

1. The problem: we all turn into shrimp at our desks during finals.
2. Show the webcam on the side, the app on screen. Calibrate live.
3. Slouch: the badge turns to SLOUCHING.
4. Keep slouching: jumpscare. (Warn the judge first. 🙂)
5. Sit up: it calms down.
6. How it works, in one sentence: on-device pose detection in the browser. No video ever leaves the laptop.

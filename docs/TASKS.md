# Plan: who does what

Submissions are due on Devpost **Sunday 9:00 AM**. Judging starts 10:30 AM in SAC Ballroom A.

The one rule that lets everyone work in parallel: **the laptop sends `G`, `B`, or `J` over serial. That's the whole contract.** Hardware can be built and tested with the Serial Monitor; software can be tested without the robot.

## Roles

Rename these to real people.

**Software lead (web app + integration + pitch)**
- [ ] Get `npm run dev` working on every laptop
- [ ] Test pose detection from the side with the real webcam; tune `config.ts`
- [ ] End-to-end test: slouch → robot angry → jumpscare
- [ ] Devpost write-up, demo script

**Hardware A (Arduino + wiring)**
- [ ] Upload `posture_bot.ino`; confirm `READY` in Serial Monitor
- [ ] Wire both servos, buzzer, LEDs; test B/G/J from Serial Monitor
- [ ] Tune `LEFT_ANGRY` / `RIGHT_ANGRY` once brows are on the plush
- [ ] If the board resets when servos move: add a capacitor or separate servo power

**Hardware B (plush build)**
- [ ] Open the plush; plan where the webcam, Arduino, and servos go
- [ ] Make eyebrows (felt/cardboard) and mount them on the servo horns
- [ ] Mount the webcam as the plush's "eye" (lens must peek out)
- [ ] Steampunk it for the theme: goggles, gears, copper/brass bits
- [ ] Route the USB cables neatly out the back

**First-timer (floater)**
- [ ] Help whoever is blocked
- [ ] Take photos/video of the build all weekend (Devpost needs them)
- [ ] Own one stretch goal below

## Milestones

| When | Goal |
| --- | --- |
| **Fri ~2 AM** | Everyone has the repo running. Skeleton shows on the webcam. Arduino reacts to B/G/J typed in Serial Monitor. |
| **Sat 12 PM** | ⭐ End-to-end works on a desk: slouch → eyebrows angry + beeping → jumpscare. |
| **Sat 6 PM** | Electronics inside the plush. Thresholds tuned on at least 2 teammates. |
| **Sat 11 PM** | Feature freeze for core. Only stretch goals and polish after this. |
| **Sun 3 AM** | Record a **backup demo video** (in case the live demo fails in the ballroom). |
| **Sun 8 AM** | Devpost submitted (don't wait for 8:59). |

## Stretch goals (only after the Sat 12 PM milestone)

- **LCD:** show "SIT UP!" and a slouch counter on the robot.
- **Ultrasonic sensor:** detect when you lean too close to the screen, or when nobody is at the desk (pause monitoring).
- **Stats panel:** "% of time with good posture" and slouch count for the session (helps the UI/UX angle).
- **Always-on-top alerts:** Chrome's Document Picture-in-Picture or an Electron wrapper so alerts show over other apps.

## Demo script (2 min)

1. The problem: we all turn into shrimp at our desks during finals.
2. Show the plush on the side, the app on screen. Calibrate live.
3. Slouch: eyebrows go angry and it beeps.
4. Keep slouching: jumpscare. (Warn the judge first. 🙂)
5. Sit up: it calms down.
6. How it works, in one sentence: on-device pose detection in the browser + Arduino over USB serial. No video ever leaves the laptop.

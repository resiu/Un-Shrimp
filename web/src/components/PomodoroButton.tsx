// The big shrimp button in the bottom-right corner. Click it to open the timer controls.
// While the timer runs, it shows the time left. The shrimp curls up as you slouch.

import { useState } from 'react'
import { fmtClock, usePomodoro } from '../pomodoro/PomodoroContext'
import { AnimatedShrimp } from './AnimatedShrimp'

export function PomodoroButton() {
  const { phase, remainingMs, workMin, breakMin, start, stop } = usePomodoro()
  const [open, setOpen] = useState(false)
  const [workDraft, setWorkDraft] = useState(String(workMin))
  const [breakDraft, setBreakDraft] = useState(String(breakMin))
  const running = phase !== 'off'
  const workValue = Number(workDraft)
  const breakValue = Number(breakDraft)
  const timesValid =
    Number.isInteger(workValue) &&
    Number.isInteger(breakValue) &&
    workValue >= 1 &&
    workValue <= 180 &&
    breakValue >= 1 &&
    breakValue <= 180

  return (
    <div className="pomo">
      <button
        type="button"
        className={`pomo-btn${phase === 'break' ? ' is-break' : ''}`}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label="Pomodoro timer"
        title="Pomodoro timer"
      >
        {!open && (
          <span className="pomo-bubble">
            <span className="pomo-bubble-text">
              {phase === 'off' && 'Click on me to start a Pomodoro focus timer!'}
              {phase === 'work' && 'Focus time! Click to check or stop the timer.'}
              {phase === 'break' && 'Break time! Get up and walk away from the screen.'}
            </span>
          </span> 
        )}
        <AnimatedShrimp size="xl" />
        {running && <span className="pomo-time">{fmtClock(remainingMs)}</span>}
      </button>

      {open && (
        <div className="pomo-menu card">
          <p className="muted small">
            {phase === 'off' && 'Focus, then a break where you walk away from the screen.'}
            {phase === 'work' && 'Focus time. Keep going!'}
            {phase === 'break' && 'Break time. Walk around!'}
          </p>
          <label>
            Focus (minutes)
            <input
              type="number"
              min={1}
              max={180}
              step={1}
              value={workDraft}
              disabled={running}
              onChange={(e) => setWorkDraft(e.target.value)}
            />
          </label>
          <label>
            Break (minutes)
            <input
              type="number"
              min={1}
              max={180}
              step={1}
              value={breakDraft}
              disabled={running}
              onChange={(e) => setBreakDraft(e.target.value)}
            />
          </label>
          {!timesValid && (
            <p className="muted small" role="alert">
              Enter whole minutes from 1 to 180.
            </p>
          )}
          {running ? (
            <button type="button" onClick={stop} disabled={phase === 'break'}>
              {phase === 'break' ? 'Locked until break ends' : 'Stop'}
            </button>
          ) : (
            <button
              type="button"
              className="primary"
              onClick={() => start(workValue, breakValue)}
              disabled={!timesValid}
            >
              Start
            </button>
          )}
        </div>
      )}
    </div>
  )
}

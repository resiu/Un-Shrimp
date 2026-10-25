// Pomodoro timer: focus sessions, then a break that locks the app on the Leaderboard.
//
//   off --Start--> work --(time's up)--> break --(time's up)--> work --> ...
//
// The dashboard camera and BreakBanner report presence. Work counts while you're present;
// breaks count while you're away.
// State is saved in localStorage, so refreshing the page can't skip a break.

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { CONFIG } from '../config'
import { playPomodoroCue } from '../lib/sound'

export type PomodoroPhase = 'off' | 'work' | 'break'

type Saved = { phase: PomodoroPhase; remainingMs: number; workMin: number; breakMin: number }

type PomodoroValue = Saved & {
  start: (workMin: number, breakMin: number) => void
  /** Ends a work session. Breaks cannot be stopped early. */
  stop: () => void
  reset: () => void
  /** true = in view, false = away, null = presence unavailable. */
  reportPresence: (present: boolean | null) => void
}

const STORAGE_KEY = 'posture-bot-pomodoro'
const CLOSED_AT_KEY = 'posture-bot-pomodoro-closed-at'
const MIN = 60_000
const RESET_AFTER_MS = 1 * MIN //MIN = 60000ms, 60 sec

function load(): Saved {
  const fallback: Saved = {
    phase: 'off',
    remainingMs: 0,
    workMin: CONFIG.pomodoroWorkMin,
    breakMin: CONFIG.pomodoroBreakMin,
  }
  try {
    const closedAt = Number(localStorage.getItem(CLOSED_AT_KEY))
    localStorage.removeItem(CLOSED_AT_KEY)
    if (closedAt > 0 && Date.now() - closedAt > RESET_AFTER_MS) return fallback

    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback
  } catch {
    return fallback
  }
}

/** Move the clock forward by `delta` ms and switch phase when it reaches zero. */
function advance(s: Saved, delta: number, present: boolean | null): Saved {
  if (s.phase === 'off') return s
  const counts = s.phase === 'work' ? present === true : present === false
  if (!counts) return s
  const remainingMs = s.remainingMs - delta
  if (remainingMs > 0) return { ...s, remainingMs }
  return s.phase === 'work'
    ? { ...s, phase: 'break', remainingMs: s.breakMin * MIN }
    : { ...s, phase: 'work', remainingMs: s.workMin * MIN }
}

function notify(title: string, body: string) {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, { body })
  }
}

/** 65000 -> "01:05" */
// oxlint-disable-next-line react/only-export-components
export function fmtClock(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const mm = String(Math.floor(total / 60)).padStart(2, '0')
  const ss = String(total % 60).padStart(2, '0')
  return `${mm}:${ss}`
}

const PomodoroContext = createContext<PomodoroValue | null>(null)

export function PomodoroProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Saved>(load)
  const presenceRef = useRef<boolean | null>(null)

  // One clock for everything. Uses real elapsed time, so a throttled background tab stays accurate.
  useEffect(() => {
    if (state.phase === 'off') return
    let last = Date.now()
    const id = setInterval(() => {
      const now = Date.now()
      const delta = now - last
      last = now
      setState((s) => advance(s, delta, presenceRef.current))
    }, 500)
    return () => clearInterval(id)
  }, [state.phase])

  // Remember the state across refreshes.
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      // storage unavailable: the timer still works, it just won't survive a refresh
    }
  }, [state])

  // Tell the user when the phase flips (matters if the tab is in the background).
  const prevPhase = useRef(state.phase)
  useEffect(() => {
    if (prevPhase.current === 'work' && state.phase === 'break') {
      playPomodoroCue('break')
      notify('Break time 🚶', 'Step away from the screen and walk around.')
    } else if (prevPhase.current === 'break' && state.phase === 'work') {
      playPomodoroCue('work')
      notify('Break over', 'Back to focus time.')
    }
    prevPhase.current = state.phase
  }, [state.phase])

  const start = useCallback((workMin: number, breakMin: number) => {
    if (
      !Number.isInteger(workMin) ||
      !Number.isInteger(breakMin) ||
      workMin < 1 ||
      workMin > 180 ||
      breakMin < 1 ||
      breakMin > 180
    ) {
      return
    }
    if ('Notification' in window && Notification.permission === 'default') {
      void Notification.requestPermission()
    }
    playPomodoroCue('work')
    setState((s) => ({
      ...s,
      phase: 'work',
      workMin,
      breakMin,
      remainingMs: workMin * MIN,
    }))
  }, [])

  const stop = useCallback(() => {
    setState((s) => {
      if (s.phase === 'break') return s
      return { ...s, phase: 'off', remainingMs: 0 }
    })
  }, [])

  const reset = useCallback(() => {
    const initial: Saved = {
      phase: 'off',
      remainingMs: 0,
      workMin: CONFIG.pomodoroWorkMin,
      breakMin: CONFIG.pomodoroBreakMin,
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(initial))
      localStorage.removeItem(CLOSED_AT_KEY)
    } catch {
      // storage unavailable: reset still applies for the current app session
    }
    presenceRef.current = null
    setState(initial)
  }, [])

  useEffect(() => {
    const markClosed = () => {
      try {
        localStorage.setItem(CLOSED_AT_KEY, String(Date.now()))
      } catch {
        // storage unavailable: the timer still works, but cannot detect time between visits
      }
    }
    const checkRestoredTab = (event: PageTransitionEvent) => {
      if (!event.persisted) return
      try {
        const closedAt = Number(localStorage.getItem(CLOSED_AT_KEY))
        localStorage.removeItem(CLOSED_AT_KEY)
        if (closedAt > 0 && Date.now() - closedAt > RESET_AFTER_MS) reset()
      } catch {
        // storage unavailable: keep the in-memory timer state
      }
    }
    window.addEventListener('pagehide', markClosed)
    window.addEventListener('beforeunload', markClosed)
    window.addEventListener('pageshow', checkRestoredTab)
    return () => {
      window.removeEventListener('pagehide', markClosed)
      window.removeEventListener('beforeunload', markClosed)
      window.removeEventListener('pageshow', checkRestoredTab)
    }
  }, [reset])

  const reportPresence = useCallback((present: boolean | null) => {
    presenceRef.current = present
  }, [])

  return (
    <PomodoroContext.Provider value={{ ...state, start, stop, reset, reportPresence }}>
      {children}
    </PomodoroContext.Provider>
  )
}

// The hook lives next to its provider on purpose; this only affects hot-reload speed.
// oxlint-disable-next-line react/only-export-components
export function usePomodoro(): PomodoroValue {
  const value = useContext(PomodoroContext)
  if (!value) throw new Error('usePomodoro must be used inside <PomodoroProvider>')
  return value
}
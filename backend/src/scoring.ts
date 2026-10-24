// All the number crunching: turns rows in the readings table into stats.
// Used by GET /api/me, GET /api/leaderboard, and the WebSocket updates.
//
// "slouch %" everywhere = share of a person's readings where slouching was true.

import { db } from './db.ts'

export type MyStats = {
  username: string
  avgScore: number | null // average 0-100 score, null if no readings yet
  slouchPct: number | null // 0-100
  totalReadings: number
  sessions: number
  improvement: number | null // first session slouch % minus latest; positive = better. Needs 2+ sessions.
}

export type LeaderboardEntry = { username: string; slouchPct: number; totalReadings: number }
export type ImprovedEntry = {
  username: string
  improvement: number
  firstSlouchPct: number
  latestSlouchPct: number
}
export type Leaderboard = {
  shrimpiest: LeaderboardEntry[]
  straightest: LeaderboardEntry[]
  mostImproved: ImprovedEntry[]
}

const TOP_N = 10
const MIN_READINGS_FOR_STRAIGHTEST = 10

const round1 = (n: number) => Math.round(n * 10) / 10

// Slouch % for each of one user's sessions that has readings, oldest first.
const sessionSlouchPcts = db.prepare<[number], { pct: number }>(`
  SELECT AVG(r.slouching) * 100 AS pct
  FROM sessions s JOIN readings r ON r.session_id = s.id
  WHERE s.user_id = ?
  GROUP BY s.id
  ORDER BY s.started_at, s.id
`)

/** First session's slouch % minus latest session's. null with fewer than 2 sessions. */
function improvementFor(userId: number): ImprovedEntry | null {
  const pcts = sessionSlouchPcts.all(userId).map((r) => r.pct)
  if (pcts.length < 2) return null
  const first = pcts[0]
  const latest = pcts[pcts.length - 1]
  return {
    username: '',
    improvement: round1(first - latest),
    firstSlouchPct: round1(first),
    latestSlouchPct: round1(latest),
  }
}

export function getMyStats(userId: number): MyStats {
  const row = db
    .prepare<[number], {
      username: string
      avgScore: number | null
      slouchPct: number | null
      totalReadings: number
      sessions: number
    }>(`
      SELECT
        u.username,
        (SELECT AVG(score)          FROM readings WHERE user_id = u.id) AS avgScore,
        (SELECT AVG(slouching) * 100 FROM readings WHERE user_id = u.id) AS slouchPct,
        (SELECT COUNT(*)            FROM readings WHERE user_id = u.id) AS totalReadings,
        (SELECT COUNT(*)            FROM sessions WHERE user_id = u.id) AS sessions
      FROM users u WHERE u.id = ?
    `)
    .get(userId)
  if (!row) throw new Error(`No user with id ${userId}`)

  return {
    username: row.username,
    avgScore: row.avgScore === null ? null : Math.round(row.avgScore),
    slouchPct: row.slouchPct === null ? null : round1(row.slouchPct),
    totalReadings: row.totalReadings,
    sessions: row.sessions,
    improvement: improvementFor(userId)?.improvement ?? null,
  }
}

export function getLeaderboard(): Leaderboard {
  // One row per user who has at least one reading.
  const perUser = db
    .prepare<[], { id: number; username: string; slouchPct: number; totalReadings: number }>(`
      SELECT u.id, u.username, AVG(r.slouching) * 100 AS slouchPct, COUNT(r.id) AS totalReadings
      FROM users u JOIN readings r ON r.user_id = u.id
      GROUP BY u.id
    `)
    .all()
    .map((u) => ({ ...u, slouchPct: round1(u.slouchPct) }))

  const entry = (u: (typeof perUser)[number]): LeaderboardEntry => ({
    username: u.username,
    slouchPct: u.slouchPct,
    totalReadings: u.totalReadings,
  })

  const shrimpiest = [...perUser]
    .sort((a, b) => b.slouchPct - a.slouchPct)
    .slice(0, TOP_N)
    .map(entry)

  const straightest = perUser
    .filter((u) => u.totalReadings >= MIN_READINGS_FOR_STRAIGHTEST)
    .sort((a, b) => a.slouchPct - b.slouchPct)
    .slice(0, TOP_N)
    .map(entry)

  const mostImproved = perUser
    .map((u) => {
      const imp = improvementFor(u.id)
      return imp && { ...imp, username: u.username }
    })
    .filter((x): x is ImprovedEntry => x !== null)
    .sort((a, b) => b.improvement - a.improvement)
    .slice(0, TOP_N)

  return { shrimpiest, straightest, mostImproved }
}

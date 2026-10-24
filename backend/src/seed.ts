// `npm run seed` fills the database with 6 fake users so the leaderboard isn't
// empty during demos. Safe to re-run: it deletes and recreates only these users.
// Every fake user's password is "password123".

import { db } from './db.ts'
import { hashPassword } from './middleware/auth.ts'

// Each user's slouch chance per session, oldest session first.
const FAKE_USERS: { username: string; sessions: number[] }[] = [
  { username: 'shrimp_king', sessions: [0.85, 0.9, 0.8] },
  { username: 'desk_goblin', sessions: [0.7, 0.65] },
  { username: 'ramrod_rita', sessions: [0.08, 0.05, 0.04] },
  { username: 'reformed_rob', sessions: [0.75, 0.5, 0.3, 0.15] },
  { username: 'meh_mike', sessions: [0.4, 0.45] },
  { username: 'newbie_nina', sessions: [0.35] },
]
const READINGS_PER_SESSION = 24 // 2 minutes of monitoring at one reading per 5 s

const password = await hashPassword('password123')

const deleteUser = db.prepare('DELETE FROM users WHERE username = ?')
const insertUser = db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)')
const insertSession = db.prepare('INSERT INTO sessions (user_id, started_at) VALUES (?, ?)')
const insertReading = db.prepare(`
  INSERT INTO readings (session_id, user_id, neck_angle, shoulder_angle, slouching, score, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`)

// A transaction makes the inserts fast and all-or-nothing.
db.transaction(() => {
  for (const fake of FAKE_USERS) {
    deleteUser.run(fake.username)
    const userId = Number(insertUser.run(fake.username, password).lastInsertRowid)

    fake.sessions.forEach((slouchChance, i) => {
      // One session per day, ending today.
      const start = new Date(Date.now() - (fake.sessions.length - i) * 24 * 3600 * 1000)
      const sessionId = Number(insertSession.run(userId, sqliteTime(start)).lastInsertRowid)

      for (let n = 0; n < READINGS_PER_SESSION; n++) {
        const slouching = Math.random() < slouchChance
        const neck = slouching ? 25 + Math.random() * 15 : 8 + Math.random() * 8
        const score = slouching ? 15 + Math.random() * 30 : 75 + Math.random() * 25
        const at = new Date(start.getTime() + n * 5000)
        insertReading.run(sessionId, userId, neck, null, slouching ? 1 : 0, Math.round(score), sqliteTime(at))
      }
    })
  }
})()

console.log(`Seeded ${FAKE_USERS.length} users (password: password123)`)

/** "2026-10-24 13:05:00", the format SQLite's datetime('now') uses. */
function sqliteTime(d: Date) {
  return d.toISOString().slice(0, 19).replace('T', ' ')
}

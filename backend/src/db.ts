// The database: one SQLite file (backend/posture.db) with three tables.
//
//   users     one row per account
//   sessions  one row each time someone clicks "Start Monitoring"
//   readings  one row every ~5 s while monitoring (belongs to a session)

import path from 'node:path'
import Database from 'better-sqlite3'

const DB_FILE = path.join(import.meta.dirname, '..', 'posture.db')

export const db = new Database(DB_FILE)
db.pragma('journal_mode = WAL') // faster, and safe with one server process
db.pragma('foreign_keys = ON') // so deleting a user also deletes their sessions/readings

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY,
    username      TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id         INTEGER PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    started_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS readings (
    id             INTEGER PRIMARY KEY,
    session_id     INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    neck_angle     REAL NOT NULL,
    shoulder_angle REAL,              -- NULL when the camera can't see the hips
    slouching      INTEGER NOT NULL,  -- SQLite has no boolean: 1 = slouching, 0 = not
    score          INTEGER NOT NULL,  -- 0-100, 100 = straight
    created_at     TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS readings_by_user ON readings(user_id);
  CREATE INDEX IF NOT EXISTS readings_by_session ON readings(session_id);
`)

export type UserRow = { id: number; username: string; password_hash: string }

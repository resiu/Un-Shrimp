// POST /api/signup  and  POST /api/login
// Both take { username, password } and return { token, user: { id, username } }.

import { Router } from 'express'
import { db, type UserRow } from '../db.ts'
import { checkPassword, createToken, hashPassword } from '../middleware/auth.ts'

export const authRouter = Router()

const USERNAME_RULE = /^[A-Za-z0-9_]{3,20}$/
const MIN_PASSWORD = 6

function readCredentials(body: unknown) {
  const { username, password } = (body ?? {}) as Record<string, unknown>
  return {
    username: typeof username === 'string' ? username.trim() : '',
    password: typeof password === 'string' ? password : '',
  }
}

authRouter.post('/signup', async (req, res) => {
  const { username, password } = readCredentials(req.body)
  if (!USERNAME_RULE.test(username)) {
    res.status(400).json({ error: 'Username must be 3-20 letters, numbers or _' })
    return
  }
  if (password.length < MIN_PASSWORD) {
    res.status(400).json({ error: `Password must be at least ${MIN_PASSWORD} characters` })
    return
  }
  if (db.prepare('SELECT 1 FROM users WHERE username = ?').get(username)) {
    res.status(409).json({ error: 'That username is taken' })
    return
  }

  const hash = await hashPassword(password)
  const result = db
    .prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)')
    .run(username, hash)
  const user = { id: Number(result.lastInsertRowid), username }
  res.status(201).json({ token: createToken(user), user })
})

authRouter.post('/login', async (req, res) => {
  const { username, password } = readCredentials(req.body)
  const row = db.prepare<[string], UserRow>('SELECT * FROM users WHERE username = ?').get(username)
  // Same message whether the username or the password is wrong, so nobody can
  // use this form to find out which usernames exist.
  if (!row || !(await checkPassword(password, row.password_hash))) {
    res.status(401).json({ error: 'Wrong username or password' })
    return
  }
  const user = { id: row.id, username: row.username }
  res.json({ token: createToken(user), user })
})

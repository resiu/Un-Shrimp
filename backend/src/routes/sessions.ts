// POST /api/sessions  (needs login) -> { sessionId }
// The browser calls this when you click "Start Monitoring". Every reading it
// sends afterwards includes this id, so we can compare first vs. latest session.

import { Router } from 'express'
import { db } from '../db.ts'
import { requireAuth, type AuthedRequest } from '../middleware/auth.ts'

export const sessionsRouter = Router()

sessionsRouter.post('/sessions', requireAuth, (req, res) => {
  const { user } = req as AuthedRequest
  const result = db.prepare('INSERT INTO sessions (user_id) VALUES (?)').run(user.id)
  res.status(201).json({ sessionId: Number(result.lastInsertRowid) })
})

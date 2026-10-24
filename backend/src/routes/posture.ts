// POST /api/posture  (needs login) saves one reading:
//   { sessionId, neckAngle, shoulderAngle (number or null), slouching (boolean), score (0-100) }
// Then it pushes fresh stats over the WebSocket (see ws.ts).

import { Router } from 'express'
import { db } from '../db.ts'
import { requireAuth, type AuthedRequest } from '../middleware/auth.ts'
import { getMyStats } from '../scoring.ts'
import { broadcastLeaderboardSoon, sendToUser } from '../ws.ts'

export const postureRouter = Router()

const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

postureRouter.post('/posture', requireAuth, (req, res) => {
  const { user } = req as AuthedRequest
  const { sessionId, neckAngle, shoulderAngle, slouching, score } = (req.body ?? {}) as Record<
    string,
    unknown
  >

  if (
    !Number.isInteger(sessionId) ||
    !isNumber(neckAngle) ||
    !(shoulderAngle === null || isNumber(shoulderAngle)) ||
    typeof slouching !== 'boolean' ||
    !isNumber(score) ||
    score < 0 ||
    score > 100
  ) {
    res.status(400).json({
      error:
        'Expected { sessionId: integer, neckAngle: number, shoulderAngle: number | null, slouching: boolean, score: 0-100 }',
    })
    return
  }

  // You can only add readings to your own sessions.
  const owns = db
    .prepare('SELECT 1 FROM sessions WHERE id = ? AND user_id = ?')
    .get(sessionId, user.id)
  if (!owns) {
    res.status(404).json({ error: 'Session not found. Click Start Monitoring again.' })
    return
  }

  db.prepare(
    `INSERT INTO readings (session_id, user_id, neck_angle, shoulder_angle, slouching, score)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(sessionId, user.id, neckAngle, shoulderAngle, slouching ? 1 : 0, Math.round(score))

  sendToUser(user.id, { type: 'myStats', data: getMyStats(user.id) })
  broadcastLeaderboardSoon()
  res.status(201).json({ ok: true })
})

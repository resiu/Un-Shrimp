// GET /api/me  (needs login) -> MyStats for whoever is logged in

import { Router } from 'express'
import { requireAuth, type AuthedRequest } from '../middleware/auth.ts'
import { getMyStats } from '../scoring.ts'

export const meRouter = Router()

meRouter.get('/me', requireAuth, (req, res) => {
  const { user } = req as AuthedRequest
  try {
    res.json(getMyStats(user.id))
  } catch {
    // Valid token, but the account is gone (e.g. the database was deleted).
    res.status(401).json({ error: 'Account not found, please log in again' })
  }
})

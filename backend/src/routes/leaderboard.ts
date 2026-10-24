// GET /api/leaderboard  (public) -> { shrimpiest, straightest, mostImproved }
// Rules for each list are in scoring.ts. Live updates come over the WebSocket.

import { Router } from 'express'
import { getLeaderboard } from '../scoring.ts'

export const leaderboardRouter = Router()

leaderboardRouter.get('/leaderboard', (_req, res) => {
  res.json(getLeaderboard())
})

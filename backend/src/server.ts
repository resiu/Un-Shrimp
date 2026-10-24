// Entry point: `npm run dev` in backend/ (or the root) runs this file.
//
// One HTTP server on port 3001 does two jobs:
//   - Express answers the REST calls under /api  (login, stats, saving readings)
//   - ws handles the WebSocket at /ws            (live leaderboard + stats)
// In development, Vite (port 5173) forwards /api and /ws here; see web/vite.config.ts.

import http from 'node:http'
import express, { type NextFunction, type Request, type Response } from 'express'
import { authRouter } from './routes/auth.ts'
import { leaderboardRouter } from './routes/leaderboard.ts'
import { meRouter } from './routes/me.ts'
import { postureRouter } from './routes/posture.ts'
import { sessionsRouter } from './routes/sessions.ts'
import { attachWebSocket } from './ws.ts'

const PORT = Number(process.env.PORT ?? 3001)

const app = express()
app.use(express.json()) // turns JSON request bodies into req.body

app.use('/api', authRouter, meRouter, sessionsRouter, postureRouter, leaderboardRouter)

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'No such API route' })
})

// Anything that throws ends up here instead of crashing the server.
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err)
  res.status(500).json({ error: 'Something went wrong on the server' })
})

const server = http.createServer(app)
attachWebSocket(server)

server.listen(PORT, () => {
  console.log(`API + WebSocket listening on http://localhost:${PORT}`)
})

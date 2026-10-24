// Live updates over WebSocket.
//
// The browser connects to  ws://<host>/ws?token=<login token>  and just listens.
// The server pushes two kinds of messages (always JSON):
//
//   { type: "leaderboard", data: Leaderboard }  to everyone, at most once every 2 s
//   { type: "myStats",     data: MyStats }      to one user, after each of their readings
//
// routes/posture.ts calls sendToUser() and broadcastLeaderboardSoon() after saving a reading.

import type { Server } from 'node:http'
import { WebSocket, WebSocketServer } from 'ws'
import { verifyToken } from './middleware/auth.ts'
import { getLeaderboard } from './scoring.ts'

const LEADERBOARD_THROTTLE_MS = 2000

// userId -> that user's open connections (they might have several tabs open)
const socketsByUser = new Map<number, Set<WebSocket>>()

export function attachWebSocket(server: Server) {
  const wss = new WebSocketServer({ server, path: '/ws' })

  wss.on('connection', (socket, req) => {
    const token = new URL(req.url ?? '', 'http://localhost').searchParams.get('token')
    const user = verifyToken(token)
    if (!user) {
      // 4001 is our "bad token" code. The browser sees it and stops retrying.
      socket.close(4001, 'Invalid token')
      return
    }

    let sockets = socketsByUser.get(user.id)
    if (!sockets) socketsByUser.set(user.id, (sockets = new Set()))
    sockets.add(socket)

    socket.on('close', () => {
      sockets.delete(socket)
      if (sockets.size === 0) socketsByUser.delete(user.id)
    })
  })
}

function send(socket: WebSocket, message: unknown) {
  if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message))
}

export function sendToUser(userId: number, message: unknown) {
  for (const socket of socketsByUser.get(userId) ?? []) send(socket, message)
}

// Throttle: lots of readings arriving at once cause only one leaderboard push.
// The leaderboard is computed when the timer fires, so it's never stale.
let lastBroadcast = 0
let pending: ReturnType<typeof setTimeout> | null = null

export function broadcastLeaderboardSoon() {
  if (pending) return // one is already scheduled; it will include this reading
  const wait = Math.max(0, lastBroadcast + LEADERBOARD_THROTTLE_MS - Date.now())
  pending = setTimeout(() => {
    pending = null
    lastBroadcast = Date.now()
    const message = { type: 'leaderboard', data: getLeaderboard() }
    for (const sockets of socketsByUser.values()) for (const s of sockets) send(s, message)
  }, wait)
}

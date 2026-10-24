// One shared WebSocket for the whole app. The backend pushes live updates here:
//   { type: "leaderboard", data: Leaderboard }  and  { type: "myStats", data: MyStats }
//
// AuthContext opens it after login and closes it on logout.
// Pages listen with onSocketMessage() and never touch the connection itself.
// If the connection drops (e.g. the backend restarts), it reconnects on its own.

import type { Leaderboard, MyStats } from './http'

export type ServerMessage =
  | { type: 'leaderboard'; data: Leaderboard }
  | { type: 'myStats'; data: MyStats }

type Listener = (message: ServerMessage) => void

const BAD_TOKEN_CODE = 4001 // the backend closes with this when the token is invalid
const MAX_RETRY_MS = 10_000

const listeners = new Set<Listener>()
let socket: WebSocket | null = null
let token: string | null = null
let retryMs = 1000
let retryTimer: ReturnType<typeof setTimeout> | null = null

export function connectSocket(newToken: string) {
  token = newToken
  open()
}

export function disconnectSocket() {
  token = null
  if (retryTimer) clearTimeout(retryTimer)
  socket?.close()
  socket = null
}

/** Subscribe to server messages. Returns an unsubscribe function (handy for useEffect). */
export function onSocketMessage(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function open() {
  if (!token) return
  socket?.close()
  // Same host as the page; Vite forwards /ws to the backend.
  const protocol = location.protocol === 'https:' ? 'wss' : 'ws'
  const ws = new WebSocket(`${protocol}://${location.host}/ws?token=${encodeURIComponent(token)}`)
  socket = ws

  ws.onopen = () => {
    retryMs = 1000
  }
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data) as ServerMessage
    for (const listener of listeners) listener(message)
  }
  ws.onclose = (event) => {
    if (socket !== ws) return // replaced by a newer connection
    socket = null
    if (!token || event.code === BAD_TOKEN_CODE) return
    // Try again, waiting a bit longer each time (1 s, 2 s, 4 s … up to 10 s).
    retryTimer = setTimeout(open, retryMs)
    retryMs = Math.min(retryMs * 2, MAX_RETRY_MS)
  }
}

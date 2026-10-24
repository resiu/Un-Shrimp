// Every call to the backend goes through this file.
// Vite forwards /api/* to the backend on port 3001 (see vite.config.ts).
// The login token is saved in localStorage and attached to each request.

const TOKEN_KEY = 'posture-bot-token'

// ---- Shapes of the data the backend sends back ----

export type User = { id: number; username: string }

export type MyStats = {
  username: string
  avgScore: number | null
  slouchPct: number | null
  totalReadings: number
  sessions: number
  improvement: number | null
}

export type LeaderboardEntry = { username: string; slouchPct: number; totalReadings: number }
export type ImprovedEntry = {
  username: string
  improvement: number
  firstSlouchPct: number
  latestSlouchPct: number
}
export type Leaderboard = {
  shrimpiest: LeaderboardEntry[]
  straightest: LeaderboardEntry[]
  mostImproved: ImprovedEntry[]
}

export type PostureReading = {
  sessionId: number
  neckAngle: number
  shoulderAngle: number | null
  slouching: boolean
  score: number
}

// ---- Token storage ----

export const getToken = () => localStorage.getItem(TOKEN_KEY)
export const setToken = (token: string) => localStorage.setItem(TOKEN_KEY, token)
export const clearToken = () => localStorage.removeItem(TOKEN_KEY)

/** Thrown when the backend answers with an error. `status` 401 means "not logged in". */
export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function request<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {}
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  let res: Response
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError(0, "Can't reach the server. Is the backend running?")
  }

  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(res.status, data.error ?? `Request failed (${res.status})`)
  return data as T
}

// ---- The API, one function per endpoint ----

export const api = {
  signup: (username: string, password: string) =>
    request<{ token: string; user: User }>('POST', '/signup', { username, password }),
  login: (username: string, password: string) =>
    request<{ token: string; user: User }>('POST', '/login', { username, password }),
  me: () => request<MyStats>('GET', '/me'),
  startSession: () => request<{ sessionId: number }>('POST', '/sessions'),
  sendReading: (reading: PostureReading) => request<{ ok: true }>('POST', '/posture', reading),
  leaderboard: () => request<Leaderboard>('GET', '/leaderboard'),
  roast: () => fetchRoast(),
}

/**
 * POST /api/roast. Not JSON like the others: on success the body is an MP3.
 * Returns the audio plus the line's text, or just the text (audio: null) when the
 * server has no ElevenLabs voice available, so the caller can speak it another way.
 */
async function fetchRoast(): Promise<{ text: string; audio: Blob | null }> {
  const token = getToken()
  const res = await fetch('/api/roast', {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (res.ok) {
    const text = decodeURIComponent(res.headers.get('X-Roast-Text') ?? '')
    return { text, audio: await res.blob() }
  }
  const data = await res.json().catch(() => ({}))
  if (typeof data.text === 'string') return { text: data.text, audio: null }
  throw new ApiError(res.status, data.error ?? `Roast failed (${res.status})`)
}

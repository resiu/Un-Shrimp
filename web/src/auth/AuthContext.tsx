// Keeps track of who is logged in, for the whole app.
// Any component can call useAuth() to get { user, login, signup, logout }.
//
// On page load: if a token is saved, we ask the backend (/api/me) whether it's
// still valid. While that check runs, `loading` is true.

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { api, ApiError, clearToken, getToken, setToken } from '../api/http'
import { connectSocket, disconnectSocket } from '../api/socket'
import { usePomodoro } from '../pomodoro/PomodoroContext'

type AuthUser = { username: string }

type AuthValue = {
  user: AuthUser | null
  loading: boolean
  login: (username: string, password: string) => Promise<void>
  signup: (username: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const { reset: resetPomodoro } = usePomodoro()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(() => getToken() !== null)

  const logout = useCallback(() => {
    resetPomodoro()
    clearToken()
    disconnectSocket()
    setUser(null)
  }, [resetPomodoro])

  // Check a saved token once, when the app starts.
  useEffect(() => {
    const token = getToken()
    if (!token) return
    api
      .me()
      .then((me) => {
        setUser({ username: me.username })
        connectSocket(token)
      })
      .catch((err) => {
        // 401 = token expired or fake. Other errors (server down) keep the token for next time.
        if (err instanceof ApiError && err.status === 401) clearToken()
      })
      .finally(() => setLoading(false))
  }, [])

  const finishLogin = useCallback((token: string, username: string) => {
    setToken(token)
    connectSocket(token)
    setUser({ username })
  }, [])

  const login = useCallback(
    async (username: string, password: string) => {
      const res = await api.login(username, password)
      finishLogin(res.token, res.user.username)
    },
    [finishLogin],
  )

  const signup = useCallback(
    async (username: string, password: string) => {
      const res = await api.signup(username, password)
      finishLogin(res.token, res.user.username)
    },
    [finishLogin],
  )

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

// The hook lives next to its provider on purpose; this only affects hot-reload speed.
// oxlint-disable-next-line react/only-export-components
export function useAuth(): AuthValue {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>')
  return value
}

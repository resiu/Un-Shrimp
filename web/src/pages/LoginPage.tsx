// Login and sign-up share one form; the link at the bottom switches modes.

import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

export function LoginPage() {
  const { user, login, signup } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const goTo = (location.state as { from?: string } | null)?.from ?? '/profile'

  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (user) return <Navigate to={goTo} replace />

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await (mode === 'login' ? login : signup)(username, password)
      navigate(goTo, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page login-page">
      <form className="card login-card" onSubmit={submit}>
        <h1>Posture Bot</h1>
        <h2>{mode === 'login' ? 'Log in' : 'Create an account'}</h2>
        <label>
          Username
          <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          />
        </label>
        {error && <p className="warn">{error}</p>}
        <button type="submit" className="primary" disabled={busy}>
          {mode === 'login' ? 'Log in' : 'Sign up'}
        </button>
        <button
          type="button"
          className="link-button"
          onClick={() => {
            setMode(mode === 'login' ? 'signup' : 'login')
            setError('')
          }}
        >
          {mode === 'login' ? 'New here? Sign up' : 'Have an account? Log in'}
        </button>
      </form>
    </div>
  )
}

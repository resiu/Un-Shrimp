// Which page shows at which URL.
//
//   /login        LoginPage (anyone)
//   /profile      ProfilePage: Shrimp Stats + the posture detector (login needed)
//   /leaderboard  LeaderboardPage (login needed)
//   anything else redirects to /profile
//
// During a Pomodoro break every page redirects to /leaderboard (see Layout).

import { useEffect, useRef } from 'react'
import {
  BrowserRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router-dom'
import { AuthProvider, useAuth } from './auth/AuthContext'
import { ProtectedRoute } from './auth/ProtectedRoute'
import { BreakBanner } from './components/BreakBanner'
import { NavBar } from './components/NavBar'
import { PomodoroButton } from './components/PomodoroButton'
import { LeaderboardPage } from './pages/LeaderboardPage'
import { LoginPage } from './pages/LoginPage'
import { ProfilePage } from './pages/ProfilePage'
import { OceanBackground } from './components/OceanBackground'
import { PomodoroProvider, usePomodoro } from './pomodoro/PomodoroContext'
import './pages.css'

function LoginRoute() {
  const { phase } = usePomodoro()
  const { user } = useAuth()
  return phase === 'break' && user
    ? <Navigate to="/leaderboard" replace />
    : <LoginPage />
}

/** The nav bar on top, then whichever page matches the URL. Locks to the Leaderboard on a break. */
function Layout() {
  const { phase } = usePomodoro()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const wasBreak = useRef(false)

  // When a break ends, send the user back to the detector.
  useEffect(() => {
    if (wasBreak.current && phase !== 'break') navigate('/profile')
    wasBreak.current = phase === 'break'
  }, [phase, navigate])

  // The lock: any other page bounces back to the leaderboard.
  if (phase === 'break' && pathname !== '/leaderboard') {
    return <Navigate to="/leaderboard" replace />
  }

  return (
    <>
      <NavBar />
      <PomodoroButton />
      {phase === 'break' && <BreakBanner />}
      <Outlet />
    </>
  )
}

export function AppRoutes() {
  return (
    <BrowserRouter>
      {/* Animated pixel ocean behind every page */}
      <OceanBackground />
      <AuthProvider>
        <PomodoroProvider>
          <Routes>
            <Route path="/login" element={<LoginRoute />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<Layout />}>
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/leaderboard" element={<LeaderboardPage />} />
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/profile" replace />} />
          </Routes>
        </PomodoroProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
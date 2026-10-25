import { NavLink } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { ShrimpIcon } from './ShrimpIcon'
import { usePomodoro } from '../pomodoro/PomodoroContext'

export function NavBar() {
  const { user, logout } = useAuth()
  const { phase } = usePomodoro()
  const onBreak = phase === 'break'
  return (
    <nav className="navbar">
      {!onBreak && <NavLink to="/profile">Shrimp Stats <ShrimpIcon /></NavLink>}
      <NavLink to="/leaderboard">Leaderboard</NavLink>
      <span className="navbar-spacer" />
      {!onBreak && (
        <>
          <span className="muted">{user?.username}</span>
          <button onClick={logout}>Log out</button>
        </>
      )}
    </nav>
  )
}

import { NavLink } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { ShrimpIcon } from './ShrimpIcon'

export function NavBar() {
  const { user, logout } = useAuth()
  return (
    <nav className="navbar">
      <NavLink to="/profile">Shrimp Stats <ShrimpIcon /></NavLink>
      <NavLink to="/leaderboard">Leaderboard</NavLink>
      <span className="navbar-spacer" />
      <span className="muted">{user?.username}</span>
      <button onClick={logout}>Log out</button>
    </nav>
  )
}

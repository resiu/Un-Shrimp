// Three leaderboards. Loads once, then updates live from the WebSocket.

import { useEffect, useState, type ReactNode } from 'react'
import { api, type Leaderboard } from '../api/http'
import { onSocketMessage } from '../api/socket'
import { ShrimpIcon } from '../components/ShrimpIcon'

export function LeaderboardPage() {
  const [board, setBoard] = useState<Leaderboard | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api.leaderboard().then(setBoard, (err) => setError(err.message))
    return onSocketMessage((msg) => {
      if (msg.type === 'leaderboard') setBoard(msg.data)
    })
  }, [])

  if (error) return <p className="page warn">{error}</p>
  if (!board) return <p className="page muted">Loading…</p>

  return (
    <div className="page">
      <h1>Leaderboard</h1>
      <div className="card-grid">
        <BoardCard
          title={<>Most Shrimp <ShrimpIcon /></>}
          hint="Highest % of time slouching"
          rows={board.shrimpiest.map((e) => [e.username, `${e.slouchPct}% slouching`])}
        />
        <BoardCard
          title="Straightest 📏"
          hint="Lowest % slouching (10+ readings)"
          rows={board.straightest.map((e) => [e.username, `${e.slouchPct}% slouching`])}
        />
        <BoardCard
          title="Most Improved 📈"
          hint="First session vs. latest session"
          rows={board.mostImproved.map((e) => [
            e.username,
            `${signed(e.improvement)} pts (${e.firstSlouchPct}% → ${e.latestSlouchPct}%)`,
          ])}
        />
      </div>
    </div>
  )
}

function BoardCard({ title, hint, rows }: { title: ReactNode; hint: string; rows: [string, string][] }) {
  return (
    <section className="card">
      <h2>{title}</h2>
      <p className="muted small">{hint}</p>
      {rows.length === 0 ? (
        <p className="muted">No one yet.</p>
      ) : (
        <ol className="board-list">
          {rows.map(([name, value]) => (
            <li key={name}>
              <span>{name}</span>
              <span className="muted">{value}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`)

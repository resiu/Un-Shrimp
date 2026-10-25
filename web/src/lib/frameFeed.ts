// Shares the detector's latest frame with any component that wants to react to it
// (like the animated shrimp), without passing props through every page.
//
//   ProfilePage's onFrame -> publishFrame(frame) -> every onFrameReport() listener
import type { FrameReport } from '../App'

type Listener = (frame: FrameReport) => void
const listeners = new Set<Listener>()

/** Called by ProfilePage for every detector frame. */
export function publishFrame(frame: FrameReport) {
  for (const listener of listeners) listener(frame)
}

/** Listen to detector frames. Returns an unsubscribe function (handy for useEffect). */
export function onFrameReport(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

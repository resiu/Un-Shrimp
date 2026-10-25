// The cooked-shrimp mascot as an inline icon, sized to the surrounding text.
// Use it wherever we'd otherwise write the 🦐 emoji.
/** large: twice the text size (used next to "Posture Bot Dashboard"). */
export function ShrimpIcon({ large = false }: { large?: boolean }) {
  return <img src="/cookedShrimp.png" alt="" className={`shrimp-icon${large ? ' shrimp-icon--lg' : ''}`} />
}

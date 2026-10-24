// Full-screen jumpscare overlay. The face is an original SVG of an angry steampunk creature.
// Want to use your own image instead? Put it at web/public/jumpscare.png and set USE_IMAGE = true.

const USE_IMAGE = false

export function Jumpscare({ visible }: { visible: boolean }) {
  if (!visible) return null
  return (
    <div className="jumpscare" role="alert" aria-live="assertive">
      {USE_IMAGE ? (
        <img src="/jumpscare.png" alt="" className="jumpscare-face" />
      ) : (
        <AngryPlush />
      )}
      <div className="jumpscare-text">SIT UP STRAIGHT.</div>
    </div>
  )
}

function AngryPlush() {
  return (
    <svg className="jumpscare-face" viewBox="0 0 400 400" aria-hidden="true">
      {/* fuzzy head */}
      <circle cx="200" cy="210" r="165" fill="#5b3a29" />
      <circle cx="200" cy="215" r="140" fill="#7a5038" />
      {/* ears */}
      <circle cx="70" cy="80" r="45" fill="#5b3a29" />
      <circle cx="330" cy="80" r="45" fill="#5b3a29" />
      {/* brass goggle rims (steel & steam!) */}
      <circle cx="140" cy="185" r="52" fill="#b8862b" stroke="#3d2a10" strokeWidth="8" />
      <circle cx="260" cy="185" r="52" fill="#b8862b" stroke="#3d2a10" strokeWidth="8" />
      <rect x="185" y="175" width="30" height="16" fill="#3d2a10" />
      {/* glowing eyes */}
      <circle cx="140" cy="190" r="34" fill="#120000" />
      <circle cx="260" cy="190" r="34" fill="#120000" />
      <circle cx="140" cy="192" r="14" fill="#ff1a1a" className="eye-glow" />
      <circle cx="260" cy="192" r="14" fill="#ff1a1a" className="eye-glow" />
      {/* ANGRY eyebrows */}
      <polygon points="80,110 190,150 185,170 75,130" fill="#1a0f08" />
      <polygon points="320,110 210,150 215,170 325,130" fill="#1a0f08" />
      {/* jagged mouth */}
      <path
        d="M110 290 Q200 250 290 290 L290 330 Q200 300 110 330 Z"
        fill="#120000"
      />
      <polygon
        points="125,292 140,318 155,284 170,314 185,278 200,312 215,278 230,314 245,284 260,318 275,292"
        fill="#f3ead8"
      />
    </svg>
  )
}

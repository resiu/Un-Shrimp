// Full-screen jumpscare overlay. The face is an original pixel-art angry shark, drawn in the
// same style as the rest of the UI (black pixel outlines, flat color bands, ocean blues).
// Want to use your own image instead? Put it at web/public/jumpscare.png and set USE_IMAGE = true.

const USE_IMAGE = false

export function Jumpscare({ visible }: { visible: boolean }) {
  if (!visible) return null
  return (
    <div className="jumpscare" role="alert" aria-live="assertive">
      {USE_IMAGE ? (
        <img src="/jumpscare.png" alt="" className="jumpscare-face" />
      ) : (
        <AngryShark />
      )}
      <div className="jumpscare-text">SIT UP STRAIGHT.</div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// The shark: built from simple shapes on an 80 x 60 pixel grid, then output as crisp SVG.
// (Artwork colors live here; Jumpscare.tsx is the one place hardcoded colors are allowed.)

const W = 80
const H = 60

const C = {
  outline: '#0b0f1a',
  body: '#4a7fae',
  bodyLight: '#7fb3da',
  bodyDark: '#2f5d88',
  belly: '#d8ecf5',
  gum: '#e2577a',
  mouth: '#5a0d1c',
  throat: '#2a0610',
  tooth: '#f4f7f8',
  toothShade: '#b9c6cc',
  pupil: '#ff2a2a',
  glint: '#ffffff',
}

const inEllipse = (x: number, y: number, cx: number, cy: number, rx: number, ry: number) =>
  ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1

/** Is pixel (x, y) inside triangle a-b-c? */
function inTriangle(x: number, y: number, a: number[], b: number[], c: number[]) {
  const px = x + 0.5
  const py = y + 0.5
  const side = (p: number[], q: number[]) => (q[0] - p[0]) * (py - p[1]) - (q[1] - p[1]) * (px - p[0])
  const d1 = side(a, b)
  const d2 = side(b, c)
  const d3 = side(c, a)
  return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0))
}

function paintShark(): Map<string, string> {
  const px = new Map<string, string>()
  const set = (x: number, y: number, c: string) => {
    if (x >= 0 && y >= 0 && x < W && y < H) px.set(`${x},${y}`, c)
  }
  const each = (test: (x: number, y: number) => boolean, color: (x: number, y: number) => string) => {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (test(x, y)) set(x, y, color(x, y))
  }

  const head = (x: number, y: number) => inEllipse(x, y, 40, 30, 36, 22)
  const dorsal = (x: number, y: number) => inTriangle(x, y, [31, 11], [50, 11], [44, 0])
  const finL = (x: number, y: number) => inTriangle(x, y, [9, 36], [19, 44], [1, 57])
  const finR = (x: number, y: number) => inTriangle(x, y, [71, 36], [61, 44], [79, 57])
  const mouthOuter = (x: number, y: number) => inEllipse(x, y, 40, 40.5, 22, 13)
  const mouthGum = (x: number, y: number) => inEllipse(x, y, 40, 40.5, 21, 12)
  const mouthInside = (x: number, y: number) => inEllipse(x, y, 40, 41, 19.5, 10.5)

  // Body: fins and dorsal fin first, then the head over them.
  each((x, y) => dorsal(x, y) || finL(x, y) || finR(x, y), (x) => (x < 40 ? C.bodyDark : C.body))
  each(head, (_x, y) => {
    if (y < 15) return C.bodyLight // light catching the top of the head
    if (y > 36) return C.belly // pale underside
    return C.body
  })
  // Shading: a darker band just inside the lower sides of the head.
  each(
    (x, y) => head(x, y) && y > 26 && !inEllipse(x, y, 40, 30, 33, 19.5) && y <= 36,
    () => C.bodyDark,
  )

  // Wide-open jaws: outline ring, pink gums, dark mouth, darker throat.
  each(mouthOuter, () => C.outline)
  each(mouthGum, () => C.gum)
  each(mouthInside, () => C.mouth)
  each((x, y) => inEllipse(x, y, 40, 45, 10, 5), () => C.throat)

  // Teeth: rows of white triangles along the top and bottom of the mouth.
  const mouthTop = (x: number) => { for (let y = 0; y < H; y++) if (mouthInside(x, y)) return y; return -1 }
  const mouthBottom = (x: number) => { for (let y = H - 1; y >= 0; y--) if (mouthInside(x, y)) return y; return -1 }
  for (let tx = 24; tx <= 56; tx += 4) {
    const top = mouthTop(tx)
    if (top < 0) continue
    for (let d = 0; d < 4; d++) {
      const half = d < 2 ? 1 : 0
      for (let dx = -half; dx <= half; dx++) set(tx + dx, top + d, d === 3 ? C.toothShade : C.tooth)
    }
  }
  for (let tx = 26; tx <= 54; tx += 4) {
    const bottom = mouthBottom(tx)
    if (bottom < 0) continue
    for (let d = 0; d < 3; d++) {
      const half = d < 1 ? 1 : 0
      for (let dx = -half; dx <= half; dx++) set(tx + dx, bottom - d, d === 2 ? C.toothShade : C.tooth)
    }
  }

  // Eyes: black with a glowing red pupil looking at you, and a glint.
  for (const [ex, dir] of [[24, 1], [56, -1]] as const) {
    each((x, y) => inEllipse(x, y, ex, 22, 4.2, 3.6), () => C.outline)
    each((x, y) => inEllipse(x, y, ex + dir * 1.2, 22.5, 2, 2), () => C.pupil)
    set(ex - 2, 20, C.glint)
  }
  // Angry brows slanting down toward the middle (2 pixels thick).
  for (let i = 0; i <= 14; i++) {
    const y = Math.round(14 + i * 0.4)
    for (const x of [16 + i, 64 - i]) {
      set(x, y, C.outline)
      set(x, y + 1, C.outline)
    }
  }
  // Nostrils and gill slits.
  set(35, 27, C.outline)
  set(45, 27, C.outline)
  for (const gx of [11, 14, 17]) {
    for (let y = 26; y <= 33; y++) {
      const bend = y > 29 ? 1 : 0
      set(gx - bend, y, C.bodyDark)
      set(W - 1 - gx + bend, y, C.bodyDark)
    }
  }

  // Black outline around the whole silhouette.
  const filled = (x: number, y: number) => px.has(`${x},${y}`)
  const outline: [number, number][] = []
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (filled(x, y) && (!filled(x - 1, y) || !filled(x + 1, y) || !filled(x, y - 1) || !filled(x, y + 1))) {
        outline.push([x, y])
      }
    }
  }
  for (const [x, y] of outline) set(x, y, C.outline)
  return px
}

/** Pixels -> one SVG path per color (horizontal runs merged). Computed once. */
const SHARK_PATHS = (() => {
  const pixels = paintShark()
  const byColor = new Map<string, string>()
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; ) {
      const color = pixels.get(`${x},${y}`)
      if (!color) { x++; continue }
      let end = x
      while (end < W && pixels.get(`${end},${y}`) === color) end++
      byColor.set(color, (byColor.get(color) ?? '') + `M${x} ${y}h${end - x}v1h-${end - x}z`)
      x = end
    }
  }
  return [...byColor]
})()

function AngryShark() {
  return (
    <svg className="jumpscare-face" viewBox={`0 0 ${W} ${H}`} shapeRendering="crispEdges" aria-hidden="true">
      {SHARK_PATHS.map(([color, d]) => (
        <path key={color} d={d} fill={color} className={color === C.pupil ? 'eye-glow' : undefined} />
      ))}
    </svg>
  )
}

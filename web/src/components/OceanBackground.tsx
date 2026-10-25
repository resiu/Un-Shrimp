// Animated pixel ocean drawn behind every page (mounted in AppRoutes.tsx).
//
// How it gets the pixel look: the scene is drawn on a tiny canvas (1/pixelSize of the
// screen) using only the flat colors from ocean.css, then the browser scales it up with
// crisp square pixels (image-rendering: pixelated). Same chunky, banded style as the
// kelp / bubble / shrimp assets.
//
// Back to front: water bands + rays + surface light -> specks -> far seaweed -> far fish
// -> mid seaweed -> near fish -> near seaweed -> bubbles -> bubble pops.
// Move the mouse over a bubble to pop it. Each part is its own small function below,
// so new effects (tints, storms, posture reactions...) can be added in one place.

import { useEffect, useRef } from 'react'
import { playPop } from '../lib/sound'
import '../ocean.css'

// A slow ocean looks smooth at 20 fps, and it leaves the CPU free for pose detection.
const MAX_FPS = 20

// Bubbles under these elements can't be popped (you're using the UI, not playing).
const UI_SELECTOR =
  'button, a, input, select, textarea, label, video, .card, .navbar, .dash-panel, .dash-stage, .dash-bubble, .stat'

export function OceanBackground({ pixelSize = 5, speed = 1 }: { pixelSize?: number; speed?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const pal = readPalette()
    const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches

    let scene = buildScene(1, 1)
    let img = ctx.createImageData(1, 1)
    let t = 0

    const render = () => {
      drawScene(img, scene, t, pal)
      ctx.putImageData(img, 0, 0)
    }
    const resize = () => {
      const W = Math.max(1, Math.ceil(window.innerWidth / pixelSize))
      const H = Math.max(1, Math.ceil(window.innerHeight / pixelSize))
      canvas.width = W
      canvas.height = H
      img = ctx.createImageData(W, H)
      scene = buildScene(W, H)
      if (reduceMotion) render()
    }

    let last = performance.now()
    let lastDraw = 0
    let raf = 0
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame)
      if (now - lastDraw < 1000 / MAX_FPS) return
      const dt = Math.min(0.1, (now - last) / 1000) * speed
      last = now
      lastDraw = now
      t += dt
      updateScene(scene, dt)
      render()
    }

    // Pop bubbles under the mouse (or a finger). The canvas itself ignores the pointer
    // so the page stays clickable; we listen on the window instead.
    const onPointerMove = (e: PointerEvent) => {
      if ((e.target as Element | null)?.closest?.(UI_SELECTOR)) return
      const x = (e.clientX / window.innerWidth) * scene.W
      const y = (e.clientY / window.innerHeight) * scene.H
      if (popBubbleAt(scene, x, y, t)) {
        playPop()
        if (reduceMotion) {
          scene.pops = [] // time stands still here, so a burst would never fade
          render()
        }
      }
    }

    resize()
    if (!reduceMotion) raf = requestAnimationFrame(frame) // pauses on its own while the tab is hidden
    window.addEventListener('resize', resize)
    window.addEventListener('pointermove', onPointerMove)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      window.removeEventListener('pointermove', onPointerMove)
    }
  }, [pixelSize, speed])

  return <canvas ref={canvasRef} className="ocean-bg" aria-hidden="true" />
}

// ---------------------------------------------------------------------------
// Colors

type RGB = [number, number, number]

const PALETTE_VARS = {
  water1: '--sea-water-1',
  water2: '--sea-water-2',
  water3: '--sea-water-3',
  water4: '--sea-water-4',
  water5: '--sea-water-5',
  water6: '--sea-water-6',
  water7: '--sea-water-7',
  caustic: '--sea-caustic',
  surfaceLight: '--sea-surface-light',
  silhouetteFar: '--sea-silhouette-far',
  silhouetteMid: '--sea-silhouette-mid',
  silhouetteNear: '--sea-silhouette-near',
  bubbleRim: '--sea-bubble-rim',
  bubbleFill: '--sea-bubble-fill',
  bubbleShine: '--sea-bubble-shine',
  speck: '--sea-speck',
  fishOutline: '--fish-outline',
} as const

const FISH_SCHEMES = ['orange', 'yellow', 'pink', 'teal'] as const
type FishColors = { body: RGB; light: RGB; fin: RGB; stripe: RGB }
type Palette = Record<keyof typeof PALETTE_VARS, RGB> & { fish: FishColors[] }

function readPalette(): Palette {
  const css = getComputedStyle(document.documentElement)
  const get = (cssVar: string) => hexToRgb(css.getPropertyValue(cssVar).trim())
  const pal = {} as Palette
  for (const [key, cssVar] of Object.entries(PALETTE_VARS) as [keyof typeof PALETTE_VARS, string][]) {
    pal[key] = get(cssVar)
  }
  pal.fish = FISH_SCHEMES.map((name) => ({
    body: get(`--fish-${name}-body`),
    light: get(`--fish-${name}-light`),
    fin: get(`--fish-${name}-fin`),
    stripe: get(`--fish-${name}-stripe`),
  }))
  return pal
}

function hexToRgb(hex: string): RGB {
  const n = parseInt(hex.replace('#', ''), 16)
  return Number.isNaN(n) ? [0, 0, 0] : [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function setPixel(img: ImageData, W: number, H: number, x: number, y: number, c: RGB) {
  if (x < 0 || y < 0 || x >= W || y >= H) return
  const i = (y * W + x) * 4
  img.data[i] = c[0]
  img.data[i + 1] = c[1]
  img.data[i + 2] = c[2]
  img.data[i + 3] = 255
}

// ---------------------------------------------------------------------------
// Scene state

type Strand = { x: number; height: number; width: number; phase: number; branches: { at: number; dir: number }[] }
type Layer = { color: 'silhouetteFar' | 'silhouetteMid' | 'silhouetteNear'; mound: Int16Array; strands: Strand[]; sway: number }
type Fish = { big: boolean; colors: number; x: number; y: number; dir: 1 | -1; speed: number; phase: number; near: boolean }
type Bubble = { x0: number; y: number; r: number; rise: number; sway: number; phase: number }
type Speck = { x: number; y: number; vx: number; vy: number }
type Pop = { x: number; y: number; r: number; born: number }

type Scene = {
  W: number
  H: number
  layers: Layer[] // far, mid, near
  rays: Float32Array // see buildRayTable
  fish: Fish[]
  bubbles: Bubble[]
  specks: Speck[]
  pops: Pop[]
}

function buildScene(W: number, H: number): Scene {
  const fish: Fish[] = []
  const fishCount = Math.max(5, Math.round(W / 45))
  while (fish.length < fishCount) fish.push(...newFishGroup(W, H, true))
  return {
    W,
    H,
    layers: [
      buildLayer(W, H, 'silhouetteFar', 0.58, 0.05, Math.round(W / 14), [0.14, 0.34], 0.9),
      buildLayer(W, H, 'silhouetteMid', 0.72, 0.045, Math.round(W / 18), [0.1, 0.26], 1.3),
      buildLayer(W, H, 'silhouetteNear', 0.86, 0.04, Math.round(W / 22), [0.07, 0.2], 1.7),
    ],
    rays: buildRayTable(W, H),
    fish,
    bubbles: Array.from({ length: Math.round((W * H) / 2600) }, () => newBubble(W, H, true)),
    specks: Array.from({ length: Math.round((W * H) / 1400) }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      vx: 0.4 + Math.random() * 1,
      vy: (Math.random() - 0.5) * 0.5,
    })),
    pops: [],
  }
}

function updateScene(s: Scene, dt: number) {
  for (let i = 0; i < s.bubbles.length; i++) {
    const b = s.bubbles[i]
    b.y -= b.rise * dt
    if (b.y < -b.r - 1) s.bubbles[i] = newBubble(s.W, s.H, false)
  }
  for (let i = 0; i < s.fish.length; i++) {
    const f = s.fish[i]
    f.x += f.dir * f.speed * dt
    const gone = f.dir > 0 ? f.x > s.W + 20 : f.x < -20
    if (gone) s.fish[i] = newFishGroup(s.W, s.H, false)[0]
  }
  for (const p of s.specks) {
    p.x += p.vx * dt
    p.y += p.vy * dt
    if (p.x >= s.W) p.x -= s.W
    if (p.y < 0 || p.y > s.H) p.vy = -p.vy
  }
}

function drawScene(img: ImageData, s: Scene, t: number, pal: Palette) {
  drawWater(img, s, t, pal)
  drawSpecks(img, s, pal)
  drawLayer(img, s, s.layers[0], t, pal)
  drawFish(img, s, t, pal, false)
  drawLayer(img, s, s.layers[1], t, pal)
  drawFish(img, s, t, pal, true)
  drawLayer(img, s, s.layers[2], t, pal)
  drawBubbles(img, s, t, pal)
  drawPops(img, s, t, pal)
}

// ---------------------------------------------------------------------------
// Water (one pass over every pixel; each pixel picks exactly one palette color)

/**
 * The two surface effects, as sums of waves:
 *   ripples (thin net of light):  sin(.19x+.7t) + sin(.27Y-.9t) + sin(.11(x-Y)+.5t) + sin(.08(x+Y)-.4t)
 *   light patches (white clumps):  sin(.075x+.22t) * sin(.42y-.12t+.02x) + .55 sin(.029x-.08t)
 * with Y = 1.8y. Every wave splits into a per-column part and a per-row part
 * (sin(a+b) = sin a cos b + cos a sin b), so each pixel needs only a few multiplications.
 */
function surfaceTables(W: number, t: number) {
  const col = (fn: (x: number) => number) => Float32Array.from({ length: W }, (_, x) => fn(x))
  return {
    r1: col((x) => Math.sin(x * 0.19 + t * 0.7)),
    r3s: col((x) => Math.sin(x * 0.11 + t * 0.5)),
    r3c: col((x) => Math.cos(x * 0.11 + t * 0.5)),
    r4s: col((x) => Math.sin(x * 0.08 - t * 0.4)),
    r4c: col((x) => Math.cos(x * 0.08 - t * 0.4)),
    l1: col((x) => Math.sin(x * 0.075 + t * 0.22)),
    l2s: col((x) => Math.sin(x * 0.02)),
    l2c: col((x) => Math.cos(x * 0.02)),
    l3: col((x) => Math.sin(x * 0.029 - t * 0.08) * 0.55),
  }
}

/**
 * Sun rays fan down from above the top-center. A pixel's position across the fan never
 * changes, so it's worked out once per screen size (the slow atan2) and reused every frame.
 */
function buildRayTable(W: number, H: number) {
  const rows = Math.ceil(H * RAY_DEPTH)
  const table = new Float32Array(W * rows)
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < W; x++) table[y * W + x] = Math.atan2(x - W / 2, y + rows * 0.35) * 3.2 + 0.5
  }
  return table
}
const RAY_DEPTH = 0.55 // rays fade out by this fraction of the height

function drawWater(img: ImageData, s: Scene, t: number, pal: Palette) {
  const { W, H, rays } = s
  const water = [pal.water1, pal.water2, pal.water3, pal.water4, pal.water5, pal.water6, pal.water7]
  const surfaceDepth = H * 0.22
  const rayRows = rays.length / W
  const hidden = s.layers[2].mound // the near seaweed covers everything below this

  // The band sway is sin(x*0.06 + t*0.5 + y*0.03). Splitting it into a per-column and a
  // per-row part (sin(a+b) = sin a cos b + cos a sin b) avoids a sin() for every pixel.
  const sinX = new Float32Array(W)
  const cosX = new Float32Array(W)
  for (let x = 0; x < W; x++) {
    sinX[x] = Math.sin(x * 0.06 + t * 0.5) * 1.4
    cosX[x] = Math.cos(x * 0.06 + t * 0.5) * 1.4
  }
  // Each ray's width shimmers on its own.
  const rayWidth = new Float32Array(8)
  for (let r = 0; r < 8; r++) rayWidth[r] = 0.3 + 0.1 * Math.sin(t * 0.8 + (r - 4) * 1.7)

  const sf = surfaceTables(W, t)

  for (let y = 0; y < H; y++) {
    const sinY = Math.sin(y * 0.03)
    const cosY = Math.cos(y * 0.03)
    const inSurface = y < surfaceDepth
    const rayFade = y < rayRows ? 1 - y / rayRows : 0
    // Per-row halves of the surface waves (see surfaceTables).
    const Y = y * 1.8
    const r2 = Math.sin(Y * 0.27 - t * 0.9)
    const q3s = Math.sin(Y * 0.11)
    const q3c = Math.cos(Y * 0.11)
    const q4s = Math.sin(Y * 0.08)
    const q4c = Math.cos(Y * 0.08)
    const g = y * 0.42 - t * 0.12
    const gs = Math.sin(g)
    const gc = Math.cos(g)
    const lightAbove = 0.85 + (y / surfaceDepth) * 0.45 // patches thin out with depth
    const rippleWidth = 0.22 - (y / surfaceDepth) * 0.14
    for (let x = 0; x < W; x++) {
      if (y > hidden[x]) continue // drawn over by the near seaweed anyway
      let c: RGB
      // Flat bands, top light -> bottom navy, whose edges sway gently.
      const sway = sinX[x] * cosY + cosX[x] * sinY
      let band = Math.floor(((y + sway) / H) * water.length)
      band = band < 0 ? 0 : band >= water.length ? water.length - 1 : band

      let surface: RGB | null = null
      if (inSurface) {
        const light = sf.l1[x] * (gs * sf.l2c[x] + gc * sf.l2s[x]) + sf.l3[x]
        const ripple =
          sf.r1[x] + r2 + (sf.r3s[x] * q3c - sf.r3c[x] * q3s) + (sf.r4s[x] * q4c + sf.r4c[x] * q4s)
        if (light > lightAbove) surface = pal.surfaceLight
        else if (Math.abs(ripple) < rippleWidth) surface = pal.caustic
      }
      if (surface) {
        c = surface
      } else {
        if (rayFade > 0) {
          const pos = rays[y * W + x]
          const ray = Math.floor(pos)
          if (pos - ray < rayWidth[(ray + 4) & 7] * rayFade && band > 0) band -= 1 // one shade lighter
        }
        c = water[band]
      }
      setPixel(img, W, H, x, y, c)
    }
  }
}

// ---------------------------------------------------------------------------
// Seaweed + coral silhouettes

function buildLayer(
  W: number,
  H: number,
  color: Layer['color'],
  base: number, // where the mound sits, as a fraction of the height
  bump: number, // how lumpy the mound is
  strandCount: number,
  heightRange: [number, number],
  sway: number,
): Layer {
  const seed = Math.random() * 100
  const mound = new Int16Array(W)
  for (let x = 0; x < W; x++) {
    const u = (Math.floor(x / 2) * 2) / W + seed // 2-pixel steps = blocky edges
    const h = Math.sin(u * 11) + Math.sin(u * 27 + 1.3) * 0.5 + Math.sin(u * 61 + 2) * 0.2
    mound[x] = Math.round(H * base - h * H * bump)
  }
  const strands: Strand[] = Array.from({ length: strandCount }, () => ({
    x: Math.random() * W,
    height: H * (heightRange[0] + Math.random() * (heightRange[1] - heightRange[0])),
    width: 3 + Math.floor(Math.random() * 3),
    phase: Math.random() * Math.PI * 2,
    // Some strands are branching coral: side arms partway up.
    branches:
      Math.random() < 0.4
        ? [
            { at: 0.35 + Math.random() * 0.15, dir: -1 },
            { at: 0.55 + Math.random() * 0.15, dir: 1 },
          ]
        : [],
  }))
  return { color, mound, strands, sway }
}

function drawLayer(img: ImageData, s: Scene, layer: Layer, t: number, pal: Palette) {
  const c = pal[layer.color]
  const { W, H } = s
  for (let x = 0; x < W; x++) for (let y = Math.max(0, layer.mound[x]); y < H; y++) setPixel(img, W, H, x, y, c)

  for (const st of layer.strands) {
    const baseX = Math.round(st.x)
    const baseY = layer.mound[Math.max(0, Math.min(W - 1, baseX))] + 1
    const h = Math.round(st.height)
    // The tip sways more than the base, like seaweed in a current.
    const swayAt = (f: number) => Math.sin(t * 0.9 + st.phase + f * 2.2) * layer.sway * 2.5 * f
    for (let k = 0; k < h; k++) {
      const f = k / h
      let w = Math.max(1, Math.round(st.width * (1 - f * 0.6)))
      let cx = Math.round(baseX + swayAt(f) - w / 2)
      // Leaves: every few pixels the frond bulges out, alternating left and right.
      const leaf = Math.floor((k + st.phase * 3) / 4)
      if ((k + Math.floor(st.phase * 3)) % 4 < 2 && f > 0.1 && f < 0.95) {
        if (leaf % 2 === 0) cx -= 2
        w += 2
      }
      for (let i = 0; i < w; i++) setPixel(img, W, H, cx + i, baseY - k, c)
    }
    for (const br of st.branches) {
      const k0 = Math.round(h * br.at)
      const len = Math.round(h * 0.3)
      const startX = baseX + swayAt(br.at)
      for (let j = 0; j < len; j++) {
        const f = j / len
        const x = Math.round(startX + br.dir * j * 0.75 + swayAt(br.at + f * 0.3) * 0.5)
        const y = baseY - k0 - Math.round(j * 0.85)
        setPixel(img, W, H, x, y, c)
        if (f < 0.5) setPixel(img, W, H, x, y - 1, c) // thicker near the trunk
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Fish: pixel sprites facing right ('.' = see-through, o = outline, b = body,
// l = light belly, f = fin/tail, s = stripe, e = eye). Two frames = a wagging tail.

const SMALL_FISH = [
  ['.....ooo...', 'oo..obbbo..', 'ofoobsbbbo.', 'offbbsbbebo', 'ofoobsllbo.', 'oo..obllo..', '.....ooo...'],
  ['.....ooo...', '.o..obbbo..', 'oofobsbbbo.', 'offbbsbbebo', 'oofobsllbo.', '.o..obllo..', '.....ooo...'],
]
const BIG_FISH = [
  [
    '........oooo....',
    '.......obbbbo...',
    'oo...oobsbbsboo.',
    'ofo.obbsbbbsbbbo',
    'offobbbsbbbsbebo',
    'ofo.obbsbllsbbbo',
    'oo...oolslllsoo.',
    '.......ollllo...',
    '........oooo....',
  ],
  [
    '........oooo....',
    '.......obbbbo...',
    '.o...oobsbbsboo.',
    'oofoobbsbbbsbbbo',
    'offobbbsbbbsbebo',
    'oofoobbsbllsbbbo',
    '.o...oolslllsoo.',
    '.......ollllo...',
    '........oooo....',
  ],
]

/** One fish, or a small school of 3 (same color and speed) swimming together. */
function newFishGroup(W: number, H: number, anywhere: boolean): Fish[] {
  const big = Math.random() < 0.3
  const dir: 1 | -1 = Math.random() < 0.5 ? 1 : -1
  const lead: Fish = {
    big,
    colors: Math.floor(Math.random() * FISH_SCHEMES.length),
    x: anywhere ? Math.random() * W : dir > 0 ? -20 - Math.random() * W * 0.4 : W + 20 + Math.random() * W * 0.4,
    y: H * (0.2 + Math.random() * 0.6),
    dir,
    speed: big ? 5 + Math.random() * 4 : 7 + Math.random() * 7, // pixels per second
    phase: Math.random() * Math.PI * 2,
    near: Math.random() < 0.5,
  }
  if (big || Math.random() > 0.35) return [lead]
  return [
    lead,
    { ...lead, x: lead.x - dir * 14, y: lead.y - 5, phase: lead.phase + 1 },
    { ...lead, x: lead.x - dir * 15, y: lead.y + 5, phase: lead.phase + 2 },
  ]
}

function drawFish(img: ImageData, s: Scene, t: number, pal: Palette, near: boolean) {
  for (const f of s.fish) {
    if (f.near !== near) continue
    const frames = f.big ? BIG_FISH : SMALL_FISH
    const sprite = frames[Math.floor(t * 3 + f.phase) % 2]
    const colors = pal.fish[f.colors]
    const w = sprite[0].length
    const x0 = Math.round(f.x)
    const y0 = Math.round(f.y + Math.sin(t * 1.5 + f.phase)) // gentle bob
    for (let r = 0; r < sprite.length; r++) {
      for (let c = 0; c < w; c++) {
        const ch = sprite[r][c]
        if (ch === '.') continue
        const color =
          ch === 'o' || ch === 'e' ? pal.fishOutline
          : ch === 'b' ? colors.body
          : ch === 'l' ? colors.light
          : ch === 'f' ? colors.fin
          : colors.stripe
        setPixel(img, s.W, s.H, f.dir > 0 ? x0 + c : x0 + (w - 1 - c), y0 + r, color)
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Bubbles (+ popping) and specks

function newBubble(W: number, H: number, anywhere: boolean): Bubble {
  const r = Math.random() < 0.45 ? 2 : Math.random() < 0.65 ? 3 : 4
  return {
    x0: Math.random() * W,
    y: anywhere ? Math.random() * H : H + r + Math.random() * H * 0.3,
    r,
    rise: 5 + Math.random() * 7 + r * 2, // pixels per second (bigger bubbles rise faster)
    sway: 0.6 + Math.random() * 1.6,
    phase: Math.random() * Math.PI * 2,
  }
}

const bubbleX = (b: Bubble, t: number) => b.x0 + Math.sin(t * 1.3 + b.phase) * b.sway

function drawBubbles(img: ImageData, s: Scene, t: number, pal: Palette) {
  for (const b of s.bubbles) {
    const cx = Math.round(bubbleX(b, t))
    const cy = Math.round(b.y)
    const r = b.r
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const d = dx * dx + dy * dy
        if (d > r * r) continue
        let c = d > (r - 1) * (r - 1) ? pal.bubbleRim : pal.bubbleFill
        if (dx === -(r - 1) && dy === -(r - 1)) c = pal.bubbleShine // highlight
        setPixel(img, s.W, s.H, cx + dx, cy + dy, c)
      }
    }
  }
}

/** Pop the first bubble under (x, y), in canvas pixels. Returns true if one popped. */
function popBubbleAt(s: Scene, x: number, y: number, t: number) {
  for (let i = 0; i < s.bubbles.length; i++) {
    const b = s.bubbles[i]
    const dx = bubbleX(b, t) - x
    const dy = b.y - y
    if (dx * dx + dy * dy <= (b.r + 1.5) * (b.r + 1.5)) {
      s.pops.push({ x: bubbleX(b, t), y: b.y, r: b.r, born: t })
      s.bubbles[i] = newBubble(s.W, s.H, false) // a fresh one rises from the bottom
      return true
    }
  }
  return false
}

const POP_LIFE = 0.3 // seconds the burst stays visible

/** A burst of 8 pixel fragments flying outward from where the bubble was. */
function drawPops(img: ImageData, s: Scene, t: number, pal: Palette) {
  s.pops = s.pops.filter((p) => t - p.born < POP_LIFE)
  for (const p of s.pops) {
    const age = (t - p.born) / POP_LIFE
    const dist = p.r + age * 6
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2
      const x = Math.round(p.x + Math.cos(a) * dist)
      const y = Math.round(p.y + Math.sin(a) * dist)
      setPixel(img, s.W, s.H, x, y, age < 0.5 ? pal.bubbleShine : pal.bubbleRim)
    }
  }
}

function drawSpecks(img: ImageData, s: Scene, pal: Palette) {
  for (const p of s.specks) setPixel(img, s.W, s.H, Math.floor(p.x), Math.floor(p.y), pal.speck)
}

// Generates a jumpscare "screech" with the Web Audio API, so no sound file is needed.
// Want a real scream? Drop an mp3 at web/public/jumpscare.mp3 and set USE_FILE = true.

const USE_FILE = false
const FILE_URL = '/jumpscare.mp3'

let ctx: AudioContext | null = null

/** Browsers block audio until the user clicks something. Call this from a click handler. */
export function unlockAudio() {
  getAudioContext()
}

/** The one shared audio engine (the roasts in roast.ts use it too). */
export function getAudioContext(): AudioContext {
  ctx ??= new AudioContext()
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

export function playScreech() {
  if (USE_FILE) {
    const audio = new Audio(FILE_URL)
    audio.volume = 1
    void audio.play()
    return
  }
  if (!ctx) return
  const now = ctx.currentTime
  const duration = 1.2

  const master = ctx.createGain()
  master.gain.setValueAtTime(0.0001, now)
  master.gain.exponentialRampToValueAtTime(0.8, now + 0.02)
  master.gain.exponentialRampToValueAtTime(0.0001, now + duration)
  master.connect(ctx.destination)

  // Two detuned sawtooth waves sweeping down = horror-movie screech.
  for (const detune of [0, 37]) {
    const osc = ctx.createOscillator()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(1400 + detune, now)
    osc.frequency.exponentialRampToValueAtTime(180, now + duration)
    osc.connect(master)
    osc.start(now)
    osc.stop(now + duration)
  }

  // A burst of noise on top for grit.
  const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * duration, ctx.sampleRate)
  const data = noiseBuffer.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  const noise = ctx.createBufferSource()
  noise.buffer = noiseBuffer
  const noiseGain = ctx.createGain()
  noiseGain.gain.value = 0.25
  noise.connect(noiseGain).connect(master)
  noise.start(now)
}

// Plays a voice-over roast (see backend/src/routes/roast.ts for where the line comes from).
//
// The more you keep slouching, the more the voice turns into an underwater shrimp:
//   level 0 = the plain ElevenLabs voice ... last level = squeaky, muffled, wobbly, bubbly.
// App.tsx decides the level; this file turns it into sound with the Web Audio API.
//
// No MP3 (no API key, ElevenLabs down)? The browser's built-in voice reads the line
// instead, with a higher pitch per level and the same bubbles, so the demo never goes silent.
// Edit the lines themselves in backend/src/roasts.ts.

import { api } from '../api/http'
import { getAudioContext } from './sound'

/** One row per shrimp level. Tweak these numbers to change how the shrimp sounds. */
const LEVELS = [
  // speed: >1 = higher (and faster) voice. muffleHz: lower = more underwater.
  // wobble: warble in cents. bubbles: per second. ambience: underwater rumble volume.
  { speed: 1.0, muffleHz: 20000, wobble: 0, bubbles: 0, ambience: 0, voicePitch: 1.0 }, // human
  { speed: 1.12, muffleHz: 6000, wobble: 0, bubbles: 1, ambience: 0, voicePitch: 1.3 },
  { speed: 1.3, muffleHz: 2200, wobble: 30, bubbles: 4, ambience: 0.03, voicePitch: 1.7 },
  { speed: 1.5, muffleHz: 1100, wobble: 60, bubbles: 9, ambience: 0.06, voicePitch: 2.0 }, // full shrimp
]

/** How many steps from human to full shrimp. */
export const SHRIMP_LEVELS = LEVELS.length

const AFTER_SCREECH_MS = 1300 // the jumpscare screech in sound.ts lasts 1.2 s

let currentSource: AudioBufferSourceNode | null = null
// Chrome can garbage-collect a speech utterance mid-sentence unless something holds on to it.
let currentUtterance: SpeechSynthesisUtterance | null = null

/**
 * Fetch a roast and play it at the given shrimp level (0 = human).
 * afterScreech: wait for the jumpscare screech to finish first.
 * Returns the line's text, or null if the roast couldn't be fetched.
 */
export async function playRoast(level: number, { afterScreech = false } = {}): Promise<string | null> {
  const lvl = LEVELS[Math.max(0, Math.min(level, LEVELS.length - 1))]
  const started = Date.now()

  let roast: { text: string; audio: Blob | null }
  try {
    roast = await api.roast()
  } catch (err) {
    console.warn('[roast] skipped: could not reach the backend. Is `npm run dev` running from the repo root?', err)
    return null
  }

  const wait = (afterScreech ? AFTER_SCREECH_MS : 0) - (Date.now() - started)
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait))

  if (roast.audio) {
    try {
      await playShrimpified(roast.audio, lvl)
      console.info(`[roast] level ${level} (ElevenLabs): ${roast.text}`)
      return roast.text
    } catch (err) {
      console.warn('[roast] could not play the ElevenLabs audio, using the browser voice instead', err)
    }
  } else {
    console.info('[roast] no ElevenLabs voice from the server (check the [api] terminal); using the browser voice')
  }

  speak(roast.text, lvl)
  console.info(`[roast] level ${level} (browser voice): ${roast.text}`)
  return roast.text
}

/** ElevenLabs MP3 -> speed/pitch -> wobble -> underwater filter -> speakers, plus bubbles. */
async function playShrimpified(mp3: Blob, lvl: (typeof LEVELS)[number]) {
  const ctx = getAudioContext()
  const buffer = await ctx.decodeAudioData(await mp3.arrayBuffer())

  currentSource?.stop()
  const source = ctx.createBufferSource()
  source.buffer = buffer
  source.playbackRate.value = lvl.speed
  currentSource = source

  // Underwater: cut the high frequencies.
  const muffle = ctx.createBiquadFilter()
  muffle.type = 'lowpass'
  muffle.frequency.value = lvl.muffleHz
  source.connect(muffle).connect(ctx.destination)

  const start = ctx.currentTime + 0.05
  const duration = buffer.duration / lvl.speed

  // Wobble: a slow wave nudging the pitch up and down, like sound through water.
  if (lvl.wobble > 0) {
    const lfo = ctx.createOscillator()
    lfo.frequency.value = 5
    const depth = ctx.createGain()
    depth.gain.value = lvl.wobble
    lfo.connect(depth).connect(source.detune)
    lfo.start(start)
    lfo.stop(start + duration)
  }

  source.start(start)
  addUnderwaterSounds(ctx, lvl, start, duration)
  source.onended = () => {
    if (currentSource === source) currentSource = null
  }
}

/** Bubbles (little rising "bloop"s) and a low rumble, scheduled over the roast. */
function addUnderwaterSounds(
  ctx: AudioContext,
  lvl: (typeof LEVELS)[number],
  start: number,
  duration: number,
) {
  const total = duration + 0.6 // let a few bubbles trail after the voice
  const count = Math.round(lvl.bubbles * total)
  for (let i = 0; i < count; i++) {
    const t = start + Math.random() * total
    const length = 0.06 + Math.random() * 0.1
    const from = 250 + Math.random() * 650
    const osc = ctx.createOscillator()
    osc.frequency.setValueAtTime(from, t)
    osc.frequency.exponentialRampToValueAtTime(from * (2 + Math.random()), t + length)
    const env = ctx.createGain()
    env.gain.setValueAtTime(0.0001, t)
    env.gain.exponentialRampToValueAtTime(0.12 + Math.random() * 0.1, t + 0.01)
    env.gain.exponentialRampToValueAtTime(0.0001, t + length)
    osc.connect(env).connect(ctx.destination)
    osc.start(t)
    osc.stop(t + length + 0.02)
  }

  if (lvl.ambience > 0) {
    // Low, filtered noise = the "under the sea" rumble.
    const noise = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * total), ctx.sampleRate)
    const data = noise.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
    const src = ctx.createBufferSource()
    src.buffer = noise
    const low = ctx.createBiquadFilter()
    low.type = 'lowpass'
    low.frequency.value = 350
    const vol = ctx.createGain()
    vol.gain.setValueAtTime(lvl.ambience, start)
    vol.gain.linearRampToValueAtTime(0, start + total)
    src.connect(low).connect(vol).connect(ctx.destination)
    src.start(start)
  }
}

/** Fallback: the browser's own voice, pitched up per level, with the same bubbles. */
function speak(text: string, lvl: (typeof LEVELS)[number]) {
  if (!('speechSynthesis' in window)) {
    console.warn('[roast] this browser has no built-in voice')
    return
  }
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.pitch = lvl.voicePitch // 0-2 in browsers; 2 = squeakiest
  utterance.rate = 1.05 + (lvl.speed - 1) * 0.6
  utterance.onerror = (e) => console.warn('[roast] browser voice failed:', e.error)
  utterance.onend = () => {
    if (currentUtterance === utterance) currentUtterance = null
  }
  currentUtterance = utterance

  const go = () => {
    speechSynthesis.resume() // Chrome sometimes leaves the voice stuck "paused"
    speechSynthesis.speak(utterance)
    const ctx = getAudioContext()
    addUnderwaterSounds(ctx, lvl, ctx.currentTime + 0.1, text.length * 0.06)
  }
  // Chrome silently drops a line spoken right after cancel(), so only cancel when
  // something is actually playing, and give it a moment before speaking.
  if (speechSynthesis.speaking || speechSynthesis.pending) {
    speechSynthesis.cancel()
    setTimeout(go, 150)
  } else {
    go()
  }
}

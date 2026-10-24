// POST /api/roast  (needs login) -> an MP3 of a random roast, voiced by ElevenLabs.
//
// The line itself is sent in the X-Roast-Text header (URL-encoded).
// If there's no ElevenLabs key, or ElevenLabs fails, it answers 503 with
// { error, text } instead, and the browser reads `text` out with its built-in voice.
//
// The API key lives only here on the server (backend/.env), never in the browser.

import { Router } from 'express'
import { requireAuth } from '../middleware/auth.ts'
import { ROASTS } from '../roasts.ts'

export const roastRouter = Router()

const API_KEY = process.env.ELEVENLABS_API_KEY
// Default: "George", one of ElevenLabs' free premade voices. Change it in .env.
const VOICE_ID = process.env.ELEVENLABS_VOICE_ID || 'JBFqnCBsd6RMkjVDRZzb'
const MODEL_ID = 'eleven_flash_v2_5' // ElevenLabs' fastest model, good for live playback

// Each line is only paid for once per server run: after that we reuse the audio.
const audioCache = new Map<string, Buffer>()

async function textToSpeech(text: string): Promise<Buffer> {
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}?output_format=mp3_44100_128`,
    {
      method: 'POST',
      headers: { 'xi-api-key': API_KEY ?? '', 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, model_id: MODEL_ID }),
      signal: AbortSignal.timeout(8000), // don't hang the jumpscare if ElevenLabs is slow
    },
  )
  if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${(await res.text()).slice(0, 200)}`)
  return Buffer.from(await res.arrayBuffer())
}

roastRouter.post('/roast', requireAuth, async (_req, res) => {
  const text = ROASTS[Math.floor(Math.random() * ROASTS.length)]

  if (!API_KEY) {
    res.status(503).json({ error: 'No ELEVENLABS_API_KEY in backend/.env', text })
    return
  }

  try {
    let audio = audioCache.get(text)
    if (!audio) {
      audio = await textToSpeech(text)
      audioCache.set(text, audio)
    }
    res.set({ 'Content-Type': 'audio/mpeg', 'X-Roast-Text': encodeURIComponent(text) })
    res.send(audio)
  } catch (err) {
    console.error('Roast voice failed:', err instanceof Error ? err.message : err)
    res.status(503).json({ error: 'ElevenLabs request failed', text })
  }
})

// Plays a voice-over roast after the jumpscare (see backend/src/routes/roast.ts).
//
// 1. Ask the backend for a roast while the screech is still playing.
// 2. Wait until the screech is over, then play the ElevenLabs MP3.
// 3. No MP3 (no API key, ElevenLabs down)? Read the line out with the
//    browser's built-in voice instead, so the demo never goes silent.
// Edit the lines themselves in backend/src/roasts.ts.

import { api } from '../api/http'

const PLAY_AFTER_MS = 1300 // the screech in sound.ts lasts 1.2 s

/** Returns the roast's text, or null if the server couldn't be reached. */
export async function playRoast(): Promise<string | null> {
  const started = Date.now()
  let roast: { text: string; audio: Blob | null }
  try {
    roast = await api.roast()
  } catch (err) {
    console.warn('Roast unavailable:', err)
    return null
  }

  const wait = PLAY_AFTER_MS - (Date.now() - started)
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait))

  if (roast.audio) {
    const url = URL.createObjectURL(roast.audio)
    const audio = new Audio(url)
    audio.onended = () => URL.revokeObjectURL(url)
    try {
      await audio.play()
      return roast.text
    } catch (err) {
      console.warn('Could not play roast audio, using browser voice:', err)
      URL.revokeObjectURL(url)
    }
  }

  speak(roast.text)
  return roast.text
}

function speak(text: string) {
  if (!('speechSynthesis' in window)) return
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.rate = 1.05
  speechSynthesis.cancel() // don't queue up behind an older roast
  speechSynthesis.speak(utterance)
}

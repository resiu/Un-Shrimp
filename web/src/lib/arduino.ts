// Sends posture to the Arduino Uno over USB with Chrome's Web Serial API.
// The sketch is arduino/src/main.cpp. One line of text at a time, ending in '\n':
//   "37"  shrimp score 0-100 (0 = straight, 100 = full shrimp), every arduinoSendMs
//   "J"   jumpscare (LED red + beep until a score below the threshold arrives)
//   "O"   LED off (not calibrated)
//
// Where the data comes from (App.tsx is not touched):
//   ProfilePage's onFrame -> noteFrame(frame)            (every frame, angles + status)
//   App.tsx -> updateArduino(status, jumpscare)          (every frame, right after)
import type { FrameReport } from '../App'
import { CONFIG } from '../config'
import type { PostureStatus } from './posture'
import { toReading } from './reading'

/**
 * The app's slouch threshold on the shrimp scale. reading.ts makes the posture score
 * exactly 50 at the config.ts thresholds, so shrimp score = 100 - score crosses 50 there too.
 * Must match SLOUCH_THRESHOLD in arduino/src/main.cpp.
 */
export const SLOUCH_SCORE = 50

// Web Serial isn't in TypeScript's DOM types yet; this is the bit we use.
type SerialPort = {
  open(options: { baudRate: number }): Promise<void>
  writable: WritableStream<Uint8Array>
}
type Serial = { requestPort(): Promise<SerialPort> }

let writer: WritableStreamDefaultWriter<Uint8Array> | null = null
const encoder = new TextEncoder()
let latestFrame: FrameReport | null = null
let lastScoreSent = 0
let ledIsOff = false

export const arduinoSupported = 'serial' in navigator

/** Asks the user to pick the Uno's port. Must be called from a click. */
export async function connectArduino() {
  const port = await (navigator as Navigator & { serial: Serial }).serial.requestPort()
  await port.open({ baudRate: CONFIG.arduinoBaud })
  // Opening the port resets the Uno; anything sent while it boots is lost.
  await new Promise((r) => setTimeout(r, CONFIG.arduinoBootMs))
  writer = port.writable.getWriter()
  lastScoreSent = 0
  ledIsOff = false
}

/** The detector's latest frame (called from ProfilePage's onFrame). */
export function noteFrame(frame: FrameReport) {
  latestFrame = frame
}

/** Called by App.tsx every frame. Sends the score ~5x/second, "J" on a jumpscare, "O" when uncalibrated. */
export function updateArduino(status: PostureStatus, jumpscare: boolean) {
  if (!writer) return
  if (jumpscare) send('J')

  if (status === 'uncalibrated' || status === 'calibrating') {
    if (!ledIsOff) send('O')
    ledIsOff = true
    return
  }

  const now = performance.now()
  if (now - lastScoreSent < CONFIG.arduinoSendMs) return
  const reading = toReading(latestFrame) // null while out of frame: keep the last color
  if (!reading) return
  lastScoreSent = now
  ledIsOff = false
  send(String(100 - reading.score)) // shrimp score: higher = more slouched
}

function send(line: string) {
  writer?.write(encoder.encode(line + '\n')).catch(() => {
    writer = null // unplugged; click Connect Arduino again
  })
}

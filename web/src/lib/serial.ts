// Talks to the Arduino over USB using the browser's Web Serial API (Chrome / Edge only).
//
// Protocol (laptop -> Arduino), one letter per line:
//   G  = good posture  (robot calm)
//   B  = bad posture   (robot angry: eyebrows + buzzer)
//   J  = jumpscare     (robot goes full chaos for a moment)
//
// The Arduino sends back plain text lines (e.g. "READY", "ACK B") which we log.

import { CONFIG } from '../config'

export type RobotCommand = 'G' | 'B' | 'J'

export class ArduinoLink {
  private port: SerialPort | null = null
  private writer: WritableStreamDefaultWriter<Uint8Array> | null = null
  private encoder = new TextEncoder()
  onLine: (line: string) => void = () => {}
  onDisconnect: () => void = () => {}

  static isSupported() {
    return 'serial' in navigator
  }

  get connected() {
    return this.writer !== null
  }

  /** Must be called from a button click (browser security rule). */
  async connect() {
    this.port = await navigator.serial.requestPort()
    await this.port.open({ baudRate: CONFIG.baudRate })
    this.writer = this.port.writable!.getWriter()
    navigator.serial.addEventListener('disconnect', (e) => {
      if (e.target === this.port) this.handleDisconnect()
    })
    void this.readLoop()
  }

  async send(cmd: RobotCommand) {
    if (!this.writer) return
    try {
      await this.writer.write(this.encoder.encode(cmd + '\n'))
    } catch (err) {
      console.error('Serial write failed', err)
      this.handleDisconnect()
    }
  }

  async disconnect() {
    try {
      this.writer?.releaseLock()
      await this.port?.close()
    } catch {
      /* ignore */
    }
    this.handleDisconnect()
  }

  private handleDisconnect() {
    this.writer = null
    this.port = null
    this.onDisconnect()
  }

  private async readLoop() {
    const port = this.port
    if (!port?.readable) return
    const decoder = new TextDecoderStream()
    const done = port.readable
      .pipeTo(decoder.writable as unknown as WritableStream<Uint8Array>)
      .catch(() => {})
    const reader = decoder.readable.getReader()
    let buffer = ''
    try {
      while (true) {
        const { value, done: finished } = await reader.read()
        if (finished) break
        buffer += value
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) if (line.trim()) this.onLine(line.trim())
      }
    } catch {
      /* port closed */
    } finally {
      reader.releaseLock()
      await done
    }
  }
}

// Copies MediaPipe's WASM runtime into public/ so the app doesn't depend on a CDN.
import { cpSync, mkdirSync } from 'node:fs'
mkdirSync('public/mediapipe', { recursive: true })
cpSync('node_modules/@mediapipe/tasks-vision/wasm', 'public/mediapipe/wasm', { recursive: true })
console.log('Copied MediaPipe WASM -> public/mediapipe/wasm')

import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision'
import { CONFIG } from '../config'

// The MediaPipe WASM files are copied from node_modules into public/mediapipe/wasm
// by `npm run copy-wasm` (runs automatically before `npm run dev` / `npm run build`).
const WASM_PATH = '/mediapipe/wasm'

export async function createPoseLandmarker(): Promise<PoseLandmarker> {
  const vision = await FilesetResolver.forVisionTasks(WASM_PATH)
  const options = (delegate: 'GPU' | 'CPU') => ({
    baseOptions: { modelAssetPath: CONFIG.modelUrl, delegate },
    runningMode: 'VIDEO' as const,
    numPoses: 1,
  })
  try {
    return await PoseLandmarker.createFromOptions(vision, options('GPU'))
  } catch (err) {
    console.warn('GPU pose model failed, falling back to CPU', err)
    return await PoseLandmarker.createFromOptions(vision, options('CPU'))
  }
}

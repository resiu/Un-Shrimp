import { createRoot } from 'react-dom/client'
import './styles.css'
import App from './App.tsx'

// Note: no <StrictMode> on purpose. It double-starts effects in dev, which
// makes camera + model setup confusing to debug at 3am.
createRoot(document.getElementById('root')!).render(<App />)

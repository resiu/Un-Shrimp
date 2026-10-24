import { createRoot } from 'react-dom/client'
import './styles.css'
import { AppRoutes } from './AppRoutes.tsx'

// Note: no <StrictMode> on purpose. It double-starts effects in dev, which
// makes camera + model setup confusing to debug at 3am.
// mounts the app into the browser DOM: create(Root).render(<App />)
//Also imports styles.css

// Document Object Model (DOM) - act as a bridge between raw HTML file and JavaScript
// --> hierachy
// DOM (the root) - entry point of the entire webpage
// Element nodes - the tags in HTML
// Attribute nodes
// Text Nodes

// AppRoutes adds login + pages around the detector (App.tsx); see AppRoutes.tsx.
createRoot(document.getElementById('root')!).render(<AppRoutes />)

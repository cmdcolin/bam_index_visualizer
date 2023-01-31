import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { Buffer } from 'buffer'
import './index.css'

// @ts-ignore
globalThis.Buffer = Buffer

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <App />,
)

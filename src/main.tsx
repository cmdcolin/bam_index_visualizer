import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { Buffer } from 'buffer'
import './index.css'

globalThis.Buffer = Buffer

ReactDOM.createRoot(document.querySelector('#root')!).render(<App />)

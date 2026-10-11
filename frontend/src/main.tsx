import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './auth'
import App from './App'
import './styles.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}><AuthProvider><App /></AuthProvider></BrowserRouter></React.StrictMode>,
)

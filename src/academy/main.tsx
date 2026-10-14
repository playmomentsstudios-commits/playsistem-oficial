import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from '../contexts/AuthContext'
import { ToastProvider } from '../contexts/ToastContext'
import { AcademyStandaloneApp } from './standalone'
import './academy.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
 <React.StrictMode>
  <BrowserRouter>
   <AuthProvider>
    <ToastProvider>
     <AcademyStandaloneApp/>
    </ToastProvider>
   </AuthProvider>
  </BrowserRouter>
 </React.StrictMode>
)

// A dedicated, privacy-preserving PWA registration: the commerce application's
// service worker is NEVER registered on this separate origin.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
 window.addEventListener('load', () => {
  void navigator.serviceWorker.register('/academy-sw.js', { scope: '/', updateViaCache: 'none' })
   .catch(() => undefined)
 }, { once: true })
}

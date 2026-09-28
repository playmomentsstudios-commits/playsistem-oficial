import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { settingsApi } from './api/settings'

void settingsApi.appSettings().then(settings=>{
  const href=settings?.favicon_url||'/favicon.svg'
  let link=document.querySelector<HTMLLinkElement>("link[rel~='icon']")
  if(!link){link=document.createElement('link');link.rel='icon';document.head.appendChild(link)}
  link.href=href
}).catch(()=>undefined)

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

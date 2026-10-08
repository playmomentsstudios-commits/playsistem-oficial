import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { siteContentApi } from './services/siteContent'
import { brandAsset } from './components/BrandImage'

void siteContentApi.settings().then(settings=>{
  const href=brandAsset(settings,'favicon')
  let link=document.querySelector<HTMLLinkElement>("link[rel~='icon']")
  if(!link){link=document.createElement('link');link.rel='icon';document.head.appendChild(link)}
  link.href=href
}).catch(()=>undefined)
window.addEventListener('sagamente:brand-updated',()=>{void siteContentApi.settings().then(settings=>{const icon=document.querySelector<HTMLLinkElement>('link[rel~="icon"]');if(icon)icon.href=brandAsset(settings,'favicon')}).catch(()=>undefined)})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

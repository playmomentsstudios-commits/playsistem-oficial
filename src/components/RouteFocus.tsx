import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

export function RouteFocus(){
 const {pathname}=useLocation()
 useEffect(()=>{
  window.scrollTo({top:0,left:0,behavior:'auto'})
  const timer=window.setTimeout(()=>{
   const target=document.querySelector<HTMLElement>('main h1, [data-route-heading]')
   if(target){target.tabIndex=-1;target.focus({preventScroll:true})}
  },0)
  return()=>window.clearTimeout(timer)
 },[pathname])
 return null
}

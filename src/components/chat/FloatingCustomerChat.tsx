import { useEffect,useRef,useState } from 'react'
import { SupportChat } from './SupportChat'

type Point={x:number;y:number}

export function FloatingCustomerChat({unread=0}:{unread?:number}){
  const [open,setOpen]=useState(false)
  const [position,setPosition]=useState<Point>({x:24,y:24})
  const drag=useRef<{startX:number;startY:number;originX:number;originY:number;moved:boolean}|null>(null)

  useEffect(()=>{
    try{
      const saved=window.localStorage.getItem('playmoments.customer.chat.position')
      if(saved){
        const value=JSON.parse(saved)
        if(Number.isFinite(value?.x)&&Number.isFinite(value?.y))setPosition(value)
      }
      setOpen(window.localStorage.getItem('playmoments.customer.chat.open')==='1')
    }catch{}
  },[])

  useEffect(()=>{
    try{window.localStorage.setItem('playmoments.customer.chat.open',open?'1':'0')}catch{}
  },[open])

  function clamp(next:Point){
    const size=56
    const maxX=Math.max(12,window.innerWidth-size-12)
    const maxY=Math.max(12,window.innerHeight-size-12)
    return {x:Math.min(maxX,Math.max(12,next.x)),y:Math.min(maxY,Math.max(12,next.y))}
  }

  function down(event:React.PointerEvent<HTMLButtonElement>){
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current={startX:event.clientX,startY:event.clientY,originX:position.x,originY:position.y,moved:false}
  }

  function move(event:React.PointerEvent<HTMLButtonElement>){
    if(!drag.current)return
    const dx=event.clientX-drag.current.startX
    const dy=event.clientY-drag.current.startY
    if(Math.abs(dx)+Math.abs(dy)>6)drag.current.moved=true
    const next=clamp({x:drag.current.originX-dx,y:drag.current.originY-dy})
    setPosition(next)
  }

  function up(){
    if(!drag.current)return
    const moved=drag.current.moved
    drag.current=null
    try{window.localStorage.setItem('playmoments.customer.chat.position',JSON.stringify(position))}catch{}
    if(!moved)setOpen(value=>!value)
  }

  return <>
    {open&&<div className="fixed z-[80] inset-2 sm:inset-auto sm:right-4 sm:bottom-24 sm:w-[min(410px,calc(100vw-24px))] sm:h-[min(680px,calc(100vh-120px))] rounded-2xl overflow-hidden border border-white/10 bg-[#111113] shadow-2xl">
      <div className="h-12 px-4 flex items-center justify-between border-b border-white/10 bg-[#0d0d0f]">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400"/>
          <span className="text-sm font-semibold">Atendimento Play Moments</span>
        </div>
        <button type="button" onClick={()=>setOpen(false)} className="w-10 h-10 rounded-xl hover:bg-white/[0.06] text-gray-400" aria-label="Fechar chat">×</button>
      </div>
      <div className="h-[calc(100%-3rem)]"><SupportChat compact/></div>
    </div>}

    <button
      type="button"
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      className="fixed z-[90] w-14 h-14 sm:w-14 sm:h-14 rounded-full bg-[#E30613] text-white shadow-2xl flex items-center justify-center cursor-grab active:cursor-grabbing select-none"
      style={{right:position.x,bottom:position.y}}
      aria-label={open?'Fechar chat':'Abrir chat'}
      title="Chat"
    >
      <svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M4 5h16v11H9l-5 4z"/><path d="M8 10h8M8 13h5"/></svg>
      {unread>0&&<span className="absolute -top-1 -right-1 min-w-6 h-6 px-1.5 rounded-full bg-[#25D366] text-white text-[10px] font-bold flex items-center justify-center border-2 border-[#0a0a0b]">{unread>99?'99+':unread}</span>}
    </button>
  </>
}

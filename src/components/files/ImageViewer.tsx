import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

/** Shared presentation only; callers retain their authenticated file loaders. */
export function ImageViewer({url,name,onClose,onDownload,downloading=false,error='',loading=false,onRetry}:{url:string;name:string;onClose:()=>void;onDownload:()=>void;downloading?:boolean;error?:string;loading?:boolean;onRetry?:()=>void}) {
  const onCloseRef=useRef(onClose)
  onCloseRef.current=onClose
  const close=useRef<HTMLButtonElement>(null)
  const pointers=useRef(new Map<number,{x:number;y:number}>())
  const gesture=useRef({distance:0,scale:1,x:0,y:0})
  const [scale,setScale]=useState(1)
  const [offset,setOffset]=useState({x:0,y:0})
  const [imageError,setImageError]=useState(false)
  useEffect(()=>{setScale(1);setOffset({x:0,y:0});setImageError(false)},[url])
  useEffect(()=>{
    const previous=document.activeElement as HTMLElement|null
    const overflow=document.body.style.overflow
    document.body.style.overflow='hidden';close.current?.focus()
    const key=(event:KeyboardEvent)=>{
      if(event.key==='Escape')onCloseRef.current()
      if(event.key==='Tab'){
        const buttons=close.current?.closest('[role="dialog"]')?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')
        if(!buttons?.length)return
        const first=buttons[0],last=buttons[buttons.length-1]
        if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}
        else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
      }
    }
    document.addEventListener('keydown',key)
    return()=>{document.body.style.overflow=overflow;document.removeEventListener('keydown',key);previous?.focus()}
  },[])
  const distance=()=>{const [a,b]=Array.from(pointers.current.values());return a&&b?Math.hypot(a.x-b.x,a.y-b.y):0}
  return createPortal(<div onPointerDown={event=>event.stopPropagation()} onClick={event=>event.stopPropagation()} onContextMenu={event=>event.stopPropagation()} role="dialog" aria-modal="true" aria-label="Visualização ampliada" className="fixed inset-0 z-[180] bg-black text-white flex flex-col" style={{paddingTop:'env(safe-area-inset-top)',paddingBottom:'env(safe-area-inset-bottom)'}}>
    <header className="flex shrink-0 items-center justify-between gap-3 px-3 h-14">
      <span className="min-w-0 truncate text-xs text-white/50" title={name}>{name}</span>
      <div className="flex items-center gap-1">
        <button type="button" onClick={onDownload} disabled={downloading} aria-label="Baixar original" title="Baixar original" className="w-11 h-11 text-xl text-white/65 disabled:opacity-40">{downloading?'…':'↓'}</button>
        <button ref={close} type="button" onClick={onClose} aria-label="Fechar visualizador" className="w-11 h-11 text-3xl">×</button>
      </div>
    </header>
    <div className="flex-1 min-h-0 overflow-hidden flex items-center justify-center touch-none" onDoubleClick={()=>{setScale(scale===1?2:1);setOffset({x:0,y:0})}}
      onPointerDown={event=>{event.currentTarget.setPointerCapture(event.pointerId);pointers.current.set(event.pointerId,{x:event.clientX,y:event.clientY});gesture.current={distance:distance(),scale,x:event.clientX,y:event.clientY}}}
      onPointerMove={event=>{if(!pointers.current.has(event.pointerId))return;pointers.current.set(event.pointerId,{x:event.clientX,y:event.clientY});if(pointers.current.size===2&&gesture.current.distance){setScale(Math.min(5,Math.max(1,gesture.current.scale*distance()/gesture.current.distance)))}else if(pointers.current.size===1&&scale>1){const dx=event.clientX-gesture.current.x,dy=event.clientY-gesture.current.y;setOffset(value=>({x:value.x+dx,y:value.y+dy}));gesture.current.x=event.clientX;gesture.current.y=event.clientY}}}
      onPointerUp={event=>{pointers.current.delete(event.pointerId);gesture.current.distance=0;if(scale<=1)setOffset({x:0,y:0})}}
      onPointerCancel={()=>{pointers.current.clear();gesture.current.distance=0}}>
      {error||imageError?<div role="alert" className="p-6 text-center text-sm text-white/70"><p>{error||'Não foi possível exibir esta imagem.'}</p>{onRetry&&<button className="min-h-11 underline" onClick={onRetry}>Tentar novamente</button>}</div>:url?<img src={url} alt={name||'Imagem'} draggable={false} className="h-full w-full object-contain select-none" style={{transform:`translate(${offset.x}px,${offset.y}px) scale(${scale})`}} onError={()=>setImageError(true)}/>:<span role="status" className="text-xs text-white/55">{loading?'Carregando imagem…':'Prévia indisponível'}</span>}
    </div>
    {scale>1&&<button type="button" className="shrink-0 h-11 text-xs text-white/60" onClick={()=>{setScale(1);setOffset({x:0,y:0})}}>Ajustar à tela</button>}
  </div>,document.body)
}

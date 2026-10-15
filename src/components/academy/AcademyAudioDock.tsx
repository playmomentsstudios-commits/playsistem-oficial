import {useRef,useState} from 'react'
import {Link} from 'react-router-dom'
import {useAcademyAudio} from '../../contexts/AcademyAudioContext'
import './academyAudio.css'

const clock=(seconds:number)=>{
 const safe=Number.isFinite(seconds)?Math.max(0,Math.floor(seconds)):0
 return Math.floor(safe/60)+':'+String(safe%60).padStart(2,'0')
}
function Glyph({name}:{name:'play'|'pause'|'back'|'next'|'left'|'right'|'list'|'close'}){
 const common={width:20,height:20,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.9,strokeLinecap:'round' as const,strokeLinejoin:'round' as const,'aria-hidden':true as const}
 return <svg {...common}>
  {name==='play'?<path d="m9 6 10 6-10 6z" fill="currentColor"/>:
   name==='pause'?<><path d="M8 6v12M16 6v12" strokeWidth="3"/></>:
   name==='back'?<><path d="M11 5 4 12l7 7V5Z" fill="currentColor"/><path d="M20 5 13 12l7 7V5Z" fill="currentColor"/></>:
   name==='next'?<><path d="m4 5 7 7-7 7V5Z" fill="currentColor"/><path d="m13 5 7 7-7 7V5Z" fill="currentColor"/></>:
   name==='left'?<path d="m15 18-6-6 6-6"/>:
   name==='right'?<path d="m9 18 6-6-6-6"/>:
   name==='list'?<><path d="M8 6h13M8 12h13M8 18h13"/><path d="M3 6h.01M3 12h.01M3 18h.01"/></>:
   <path d="M6 6 18 18M18 6 6 18"/>}
 </svg>
}
export function AcademyAudioDock(){
 const audio=useAcademyAudio()
 const [collapsed,setCollapsed]=useState(false)
 const [expanded,setExpanded]=useState(false)
 const gestureX=useRef<number|null>(null)
 if(!audio.current)return null
 const current=audio.current
 const currentIndex=audio.queue.findIndex(item=>item.id===current.id)
 const swiping=(delta:number)=>{
  if(delta>65)setCollapsed(true)
  else if(delta< -65)setCollapsed(false)
 }
 const onTouchStart=(e:React.TouchEvent)=>{gestureX.current=e.changedTouches[0]?.clientX??null}
 const onTouchEnd=(e:React.TouchEvent)=>{
  const last=e.changedTouches[0]?.clientX
  if(gestureX.current!==null&&last!==undefined)swiping(last-gestureX.current)
  gestureX.current=null
 }
 const toggle=()=>audio.toggle()
 return <aside aria-label="Reprodutor flutuante da Academia" className={'ac-audio-dock '+(collapsed?'is-collapsed':'')+' '+(expanded?'is-expanded':'')}
  onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
  {collapsed?<button type="button" className="ac-audio-edge" onClick={()=>setCollapsed(false)} aria-label="Expandir miniplayer do audiobook">
   <Glyph name="left"/><span aria-hidden="true">♫</span>
  </button>:<div className="ac-audio-panel">
   <div className="ac-audio-bar">
    <div className="ac-audio-art" aria-hidden="true">{current.cover_url?<img src={current.cover_url} alt=""/>:<span>♫</span>}</div>
    <div className="ac-audio-info">
     <Link to={'/app/academia/biblioteca/'+current.id} className="ac-audio-title" title={current.title}>{current.title}</Link>
     <span className="ac-audio-sub">{audio.loading?'Preparando áudio...':audio.playing?'Reproduzindo':'Em pausa'} · {clock(audio.position)} / {clock(audio.duration)}</span>
    </div>
    <div className="ac-audio-actions">
     <button type="button" className="ac-audio-icon ac-audio-optional" aria-label="Audiobook anterior" title="Anterior" onClick={audio.previous} disabled={audio.loading}><Glyph name="back"/></button>
     <button type="button" className="ac-audio-icon ac-audio-primary" aria-label={audio.playing?'Pausar audiobook':'Reproduzir audiobook'} title={audio.playing?'Pausar':'Reproduzir'} onClick={toggle} disabled={audio.loading}><Glyph name={audio.playing?'pause':'play'}/></button>
     <button type="button" className="ac-audio-icon" aria-label="Próximo audiobook" title="Próximo" onClick={audio.next} disabled={audio.loading||audio.queue.length<2}><Glyph name="next"/></button>
     <button type="button" className="ac-audio-icon ac-audio-playlist" aria-label={expanded?'Ocultar playlist':'Abrir playlist'} aria-expanded={expanded} onClick={()=>setExpanded(v=>!v)}><Glyph name="list"/></button>
     <button type="button" className="ac-audio-icon ac-audio-collapse" aria-label="Recolher player para a lateral" title="Recolher" onClick={()=>{setCollapsed(true);setExpanded(false)}}><Glyph name="right"/></button>
    </div>
   </div>
   <div className="ac-audio-progress">
    <input aria-label="Posição do audiobook" type="range" min={0} max={audio.duration>0?audio.duration:1} step={1} value={Math.min(audio.position,audio.duration||1)}
     onChange={e=>audio.seek(Number(e.target.value))} disabled={!audio.duration||audio.loading}/>
   </div>
   {audio.error&&<div role="alert" className="ac-audio-error">{audio.error} <button onClick={audio.retry} type="button">Tentar novamente</button></div>}
   {expanded&&<div className="ac-audio-expanded">
    <div className="ac-audio-options">
     <label className="ac-audio-check"><input type="checkbox" checked={audio.autoplay} onChange={e=>audio.setAutoplay(e.target.checked)}/> Reproduzir o próximo automaticamente</label>
     <label className="ac-audio-check"><input type="checkbox" checked={audio.repeat} onChange={e=>audio.setRepeat(e.target.checked)}/> Repetir playlist</label>
     <label className="ac-audio-speed">Velocidade
      <select value={audio.rate} onChange={e=>audio.setSpeed(Number(e.target.value))}>
       {[0.75,1,1.25,1.5,2].map(value=><option value={value} key={value}>{value}×</option>)}
      </select>
     </label>
    </div>
    <div className="ac-audio-queue" role="group" aria-label="Playlist dos seus audiobooks">
     <div className="ac-audio-queue-heading">Seus audiobooks · {audio.queue.length} faixas <span>Faixa {Math.max(0,currentIndex)+1}</span></div>
     {audio.queue.map((item,i)=><button type="button" key={item.id} onClick={()=>{void audio.playItem(item.id,true)}} aria-current={item.id===current.id?'true':undefined}
      className={'ac-audio-track '+(item.id===current.id?'is-active':'')}>
      <span className="ac-audio-track-number">{item.id===current.id&&audio.playing?'♫':i+1}</span>
      <span className="ac-audio-track-title">{item.title}</span>
      <span className="ac-audio-track-format">{item.release_code}</span>
     </button>)}
     {audio.queue.length===0&&<p className="ac-audio-empty">Nenhum audiobook liberado no momento.</p>}
    </div>
    <p className="ac-audio-disclaimer">A playlist inclui somente os audiobooks liberados para sua conta. Na primeira reprodução após uma troca de faixa, o celular pode exigir um toque em reproduzir.</p>
   </div>}
  </div>}
 </aside>
}

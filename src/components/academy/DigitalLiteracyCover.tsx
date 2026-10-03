import type { CSSProperties } from 'react'

type Props={
  compact?:boolean
  className?:string
  style?:CSSProperties
}

export function DigitalLiteracyCover({compact=false,className='',style}:Props){
 return <div
  className={'pm-digital-cover '+(compact?'pm-digital-cover--compact ':'')+className}
  style={style}
  role="img"
  aria-label="Capa visual do curso Letramento Digital"
 >
  <style>{DIGITAL_COVER_STYLES}</style>
  <div className="pm-digital-cover__grid" aria-hidden="true"/>
  <div className="pm-digital-cover__glow pm-digital-cover__glow-a" aria-hidden="true"/>
  <div className="pm-digital-cover__glow pm-digital-cover__glow-b" aria-hidden="true"/>
  <div className="pm-digital-cover__orbit pm-digital-cover__orbit-a" aria-hidden="true"/>
  <div className="pm-digital-cover__orbit pm-digital-cover__orbit-b" aria-hidden="true"/>
  <div className="pm-digital-cover__chips" aria-hidden="true">
   <span>AI</span><span>WEB</span><span>INFO</span>
  </div>
  <div className="pm-digital-cover__content">
   <p>ACADEMIA PLAY MOMENTS</p>
   <div className="pm-digital-cover__symbol" aria-hidden="true">⌘</div>
   <h3>Letramento<br/><b>Digital</b></h3>
   <span>Tecnologia · autonomia · futuro</span>
  </div>
  <div className="pm-digital-cover__footer">
   <span>CURSO GRATUITO</span>
   <span>06 MÓDULOS</span>
  </div>
 </div>
}

const DIGITAL_COVER_STYLES=`
.pm-digital-cover{
 position:relative;
 width:100%;
 height:100%;
 min-height:220px;
 overflow:hidden;
 isolation:isolate;
 border-radius:inherit;
 background:
  radial-gradient(circle at 78% 28%,rgba(227,6,19,.2),transparent 28%),
  linear-gradient(145deg,#161619 0%,#0b0b0d 58%,#170607 100%);
 color:#fff;
}
.pm-digital-cover__grid{
 position:absolute;inset:40% -20% -28% 18%;
 transform:rotateX(68deg) rotateZ(-8deg);
 transform-origin:center top;
 background-image:
  linear-gradient(rgba(255,255,255,.055) 1px,transparent 1px),
  linear-gradient(90deg,rgba(255,255,255,.055) 1px,transparent 1px);
 background-size:34px 34px;
 mask-image:linear-gradient(to bottom,#000,transparent 78%);
}
.pm-digital-cover__glow{position:absolute;border-radius:50%;filter:blur(34px);opacity:.4}
.pm-digital-cover__glow-a{width:160px;height:160px;right:-40px;top:-25px;background:#E30613}
.pm-digital-cover__glow-b{width:130px;height:130px;left:-50px;bottom:-45px;background:#5b33ff;opacity:.2}
.pm-digital-cover__orbit{position:absolute;border:1px solid rgba(255,61,76,.35);border-radius:50%;pointer-events:none}
.pm-digital-cover__orbit-a{width:210px;height:210px;right:-45px;top:8%;transform:rotateX(70deg);animation:pm-digital-orbit 11s linear infinite}
.pm-digital-cover__orbit-b{width:135px;height:135px;right:12%;top:16%;transform:rotateY(70deg);opacity:.5;animation:pm-digital-orbit-b 8s linear infinite reverse}
.pm-digital-cover__content{position:relative;z-index:2;padding:1.3rem 1.4rem 2.6rem;max-width:78%}
.pm-digital-cover__content>p{margin:0;color:#ff6672;font-size:.55rem;font-weight:800;letter-spacing:.17em}
.pm-digital-cover__symbol{
 display:grid;place-items:center;
 width:42px;height:42px;margin:1rem 0 .8rem;
 border:1px solid rgba(255,255,255,.14);
 border-radius:14px;background:rgba(255,255,255,.045);
 color:#ff4b59;font-size:1.25rem;font-weight:800;
 box-shadow:0 0 30px rgba(227,6,19,.13)
}
.pm-digital-cover__content h3{margin:0;font-size:clamp(1.7rem,4vw,3.4rem);line-height:.87;letter-spacing:-.05em;font-weight:850}
.pm-digital-cover__content h3 b{color:#E30613;font-weight:900}
.pm-digital-cover__content>span{display:block;margin-top:.8rem;color:#8b8b96;font-size:.7rem;line-height:1.4}
.pm-digital-cover__footer{
 position:absolute;z-index:2;left:1.4rem;right:1.4rem;bottom:1rem;
 display:flex;justify-content:space-between;gap:1rem;
 padding-top:.65rem;border-top:1px solid rgba(255,255,255,.08);
 color:#62626c;font-size:.48rem;font-weight:800;letter-spacing:.14em
}
.pm-digital-cover__chips{position:absolute;z-index:2;right:1rem;top:1rem;display:flex;gap:.35rem}
.pm-digital-cover__chips span{padding:.32rem .4rem;border:1px solid rgba(255,255,255,.09);border-radius:999px;background:rgba(255,255,255,.035);color:#6d6d78;font-size:.42rem;font-weight:800}
.pm-digital-cover--compact{min-height:180px}
.pm-digital-cover--compact .pm-digital-cover__content{padding:1rem 1rem 2.2rem}
.pm-digital-cover--compact .pm-digital-cover__content h3{font-size:2rem}
.pm-digital-cover--compact .pm-digital-cover__footer{left:1rem;right:1rem}
@keyframes pm-digital-orbit{to{transform:rotateX(70deg) rotateZ(360deg)}}
@keyframes pm-digital-orbit-b{to{transform:rotateY(70deg) rotateZ(360deg)}}
@media(prefers-reduced-motion:reduce){.pm-digital-cover__orbit{animation:none!important}}
`

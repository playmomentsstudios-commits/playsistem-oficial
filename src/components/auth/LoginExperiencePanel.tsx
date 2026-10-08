import { BrandImage } from '../BrandImage'
import { useEffect,useState,type CSSProperties,type PointerEvent } from 'react'
import { Link } from 'react-router-dom'

const PARTICLES=Array.from({length:24},(_,i)=>({
 id:i,
 x:6+((i*31)%88),
 y:8+((i*43)%82),
 size:2+(i%4),
 delay:(i%7)*120,
}))

export function LoginExperiencePanel(){
 const [tilt,setTilt]=useState({x:0,y:0})
 const [reducedMotion,setReducedMotion]=useState(false)

 useEffect(()=>{
  const media=window.matchMedia('(prefers-reduced-motion: reduce)')
  const sync=()=>setReducedMotion(media.matches)
  sync()
  media.addEventListener?.('change',sync)
  return()=>media.removeEventListener?.('change',sync)
 },[])

 function onPointerMove(event:PointerEvent<HTMLDivElement>){
  if(reducedMotion||event.pointerType==='touch')return
  const rect=event.currentTarget.getBoundingClientRect()
  const x=(event.clientX-rect.left)/rect.width-.5
  const y=(event.clientY-rect.top)/rect.height-.5
  setTilt({x:x*9,y:y*-7})
 }

 const style={
  '--pm-login-x':tilt.x+'deg',
  '--pm-login-y':tilt.y+'deg',
 } as CSSProperties

 return <div
  className="pm-login-lab hidden lg:flex"
  style={style}
  onPointerMove={onPointerMove}
  onPointerLeave={()=>setTilt({x:0,y:0})}
 >
  <style>{LOGIN_LAB_STYLES}</style>

  <div className="pm-login-bg" aria-hidden="true">
   <div className="pm-login-grid"/>
   <div className="pm-login-glow pm-login-glow-a"/>
   <div className="pm-login-glow pm-login-glow-b"/>
   <div className="pm-login-orbit pm-login-orbit-a"/>
   <div className="pm-login-orbit pm-login-orbit-b"/>
   <div className="pm-login-word">SAGA</div>

   <div className="pm-login-object-zone">
    <div className="pm-login-object">
     <div className="pm-login-object-face"/>
     <div className="pm-login-object-screen">
      <BrandImage variant="symbol" alt="" aria-hidden="true"/>
      <small>SEU ESPAÇO</small>
     </div>
    </div>
    <div className="pm-login-object-shadow"/>
   </div>

   <div className="pm-login-particles">
    {PARTICLES.map(p=><i key={p.id} style={{left:p.x+'%',top:p.y+'%',width:p.size,height:p.size,animationDelay:p.delay+'ms'}}/>)}
   </div>

   <div className="pm-login-float pm-login-float-a"><span>ACADEMIA</span><b>ATIVA</b></div>
   <div className="pm-login-float pm-login-float-b"><span>SAGAMENTE</span><b>ACESSO</b></div>
  </div>

  <div className="pm-login-vignette" aria-hidden="true"/>

  <div className="pm-login-content">
   <Link to="/" className="relative z-10 w-fit">
    <BrandImage variant="dark" alt="Sagamente" style={{height:32}}/>
   </Link>

   <div className="pm-login-copy">
    <p>SEU ESPAÇO NA SAGAMENTE</p>
    <h2>
     Tudo o que você cria,
     <span> aprende e acompanha.</span>
    </h2>
    <div className="pm-login-copyline">
     <i/>
     <b>TECNOLOGIA · CRIAÇÃO · CONHECIMENTO</b>
    </div>
    <p className="pm-login-lead">
     Entre para continuar seus cursos na Academia, acompanhar projetos e pedidos, acessar arquivos e manter suas conversas organizadas.
    </p>

    <div className="pm-login-features">
     {[
      ['▶','Academia e cursos'],
      ['◇','Projetos e pedidos'],
      ['↗','Arquivos organizados'],
      ['◌','Conversas em um só lugar'],
     ].map(([icon,label],index)=><div key={label}>
      <span>{icon}</span>
      <b>{label}</b>
      <small>0{index+1}</small>
     </div>)}
    </div>
   </div>

   <div className="pm-login-footer">
    <span>© {new Date().getFullYear()} Sagamente</span>
    <Link to="/academia">Conhecer a Academia →</Link>
   </div>
  </div>
 </div>
}

export function LoginMobileExperience(){
 return <div className="pm-login-mobile lg:hidden" aria-hidden="true">
  <div className="pm-login-mobile-grid"/>
  <div className="pm-login-mobile-glow"/>
  <div className="pm-login-mobile-orbit"/>
  <div className="pm-login-mobile-object">
   <div className="pm-login-mobile-object-face"/>
   <div className="pm-login-mobile-object-screen"><BrandImage variant="symbol" alt=""/></div>
  </div>
  <div className="pm-login-mobile-copy">
   <p>SAGAMENTE / ÁREA PESSOAL</p>
   <h2>Crie. Aprenda.<br/><b>Acompanhe.</b></h2>
  </div>
 </div>
}

const LOGIN_LAB_STYLES=`
.pm-login-lab{
 --pm-login-x:0deg;
 --pm-login-y:0deg;
 position:relative;
 flex:1;
 min-height:100vh;
 overflow:hidden;
 isolation:isolate;
 background:#0b0b0d;
 border-right:1px solid rgba(255,255,255,.05);
 perspective:1200px;
}
.pm-login-bg{position:absolute;inset:0;overflow:hidden;pointer-events:none}
.pm-login-vignette{position:absolute;inset:0;z-index:1;pointer-events:none;background:linear-gradient(90deg,rgba(11,11,13,.96) 0%,rgba(11,11,13,.8) 48%,rgba(11,11,13,.26) 82%,rgba(11,11,13,.55) 100%),linear-gradient(0deg,rgba(11,11,13,.98),transparent 38%,rgba(11,11,13,.45))}
.pm-login-grid{
 position:absolute;left:30%;right:-35%;top:42%;bottom:-38%;
 transform:rotateX(66deg) rotateZ(-8deg);
 transform-origin:center top;
 background-image:
  linear-gradient(rgba(255,255,255,.05) 1px,transparent 1px),
  linear-gradient(90deg,rgba(255,255,255,.05) 1px,transparent 1px);
 background-size:44px 44px;
 mask-image:linear-gradient(to bottom,#000,transparent 78%);
 opacity:.55;
}
.pm-login-glow{position:absolute;border-radius:50%;filter:blur(75px);opacity:.3}
.pm-login-glow-a{width:440px;height:440px;right:-130px;top:4%;background:#A65A2A}
.pm-login-glow-b{width:340px;height:340px;right:18%;bottom:-170px;background:#2E5D46;opacity:.16}
.pm-login-orbit{position:absolute;border:1px solid rgba(196,138,58,.3);border-radius:50%;right:4%;top:49%}
.pm-login-orbit-a{width:430px;height:430px;transform:translateY(-50%) rotateX(72deg) rotateZ(12deg);animation:pm-login-orbit-a 15s linear infinite}
.pm-login-orbit-b{width:290px;height:290px;right:14%;transform:translateY(-50%) rotateY(72deg) rotateZ(35deg);opacity:.48;animation:pm-login-orbit-b 10s linear infinite reverse}
.pm-login-word{position:absolute;right:-.08em;bottom:10%;font-size:clamp(8rem,16vw,15rem);font-weight:900;line-height:.75;letter-spacing:-.08em;color:transparent;-webkit-text-stroke:1px rgba(255,255,255,.04)}
.pm-login-object-zone{
 position:absolute;right:1%;top:16%;width:48%;height:64%;
 display:grid;place-items:center;
 transform:rotateX(var(--pm-login-y)) rotateY(var(--pm-login-x));
 transition:transform .15s ease-out;
 transform-style:preserve-3d;
}
.pm-login-object{position:relative;width:225px;height:280px;transform-style:preserve-3d;animation:pm-login-float 5s ease-in-out infinite}
.pm-login-object-face,.pm-login-object-screen{position:absolute;inset:0;border-radius:42px}
.pm-login-object-face{
 background:linear-gradient(145deg,rgba(255,255,255,.2),transparent 20%),linear-gradient(145deg,#38271e,#151818 48%,#08080b);
 border:1px solid rgba(255,255,255,.18);
 box-shadow:inset -20px -20px 55px rgba(0,0,0,.45),28px 35px 90px rgba(0,0,0,.48);
 transform:rotateX(-7deg) rotateY(-24deg);
}
.pm-login-object-screen{
 inset:22px;
 display:flex;flex-direction:column;align-items:center;justify-content:center;gap:.75rem;
 background:radial-gradient(circle at 50% 42%,rgba(166,90,42,.18),transparent 44%),rgba(0,0,0,.14);
 border:1px solid rgba(255,255,255,.1);
 transform:translateZ(28px) rotateX(-7deg) rotateY(-24deg);
}
.pm-login-object-screen span{display:grid;place-items:center;width:82px;height:82px;border-radius:26px;border:1px solid rgba(196,138,58,.45);background:rgba(166,90,42,.1);color:#fff;font-size:1.6rem;font-weight:900;box-shadow:0 0 50px rgba(166,90,42,.18)}
.pm-login-object-screen img{height:67px;width:56px;object-fit:contain;filter:drop-shadow(0 8px 14px rgba(0,0,0,.35))}
.pm-login-object-screen small{font-size:.55rem;letter-spacing:.22em;font-weight:800;color:#73737d}
.pm-login-object-shadow{position:absolute;left:50%;bottom:11%;width:220px;height:44px;transform:translateX(-50%) rotateX(76deg);border-radius:50%;background:#62452c;filter:blur(24px);opacity:.55}
.pm-login-particles{position:absolute;inset:0}
.pm-login-particles i{position:absolute;display:block;border-radius:50%;background:#A65A2A;box-shadow:0 0 12px #A65A2A;opacity:.12;animation:pm-login-particle 3.6s ease-in-out infinite}
.pm-login-float{position:absolute;right:3%;z-index:2;min-width:145px;padding:.7rem .85rem;border:1px solid rgba(255,255,255,.08);background:rgba(8,8,10,.42);backdrop-filter:blur(14px);border-radius:12px;display:flex;align-items:center;justify-content:space-between;gap:1rem}
.pm-login-float span{font-size:.48rem;letter-spacing:.14em;color:#5d5d68}.pm-login-float b{font-size:.58rem;color:#d8d8dd}
.pm-login-float-a{top:15%}.pm-login-float-b{bottom:23%;right:17%}

.pm-login-content{position:relative;z-index:3;width:100%;min-height:100vh;padding:3rem;display:flex;flex-direction:column;justify-content:space-between}
.pm-login-copy{max-width:520px}
.pm-login-copy>p:first-child{margin:0 0 1rem;color:#DFA269;font-size:.66rem;font-weight:800;letter-spacing:.18em}
.pm-login-copy h2{margin:0;color:#f3f3f5;font-size:clamp(2.5rem,4vw,4.4rem);line-height:.9;letter-spacing:-.05em;font-weight:900}
.pm-login-copy h2 span{display:block;color:#A65A2A;text-shadow:0 0 45px rgba(166,90,42,.13)}
.pm-login-copyline{display:flex;align-items:center;gap:.7rem;margin-top:1.15rem}.pm-login-copyline i{width:36px;height:1px;background:#A65A2A;box-shadow:0 0 14px rgba(166,90,42,.6)}.pm-login-copyline b{font-size:.52rem;letter-spacing:.12em;color:#60606b}
.pm-login-lead{max-width:430px;margin:1.15rem 0 0;color:#868692;font-size:.9rem;line-height:1.65}
.pm-login-features{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.65rem;margin-top:1.6rem;max-width:440px}
.pm-login-features div{position:relative;display:flex;align-items:center;gap:.65rem;min-height:48px;padding:.75rem .85rem;border:1px solid rgba(255,255,255,.07);border-radius:12px;background:rgba(255,255,255,.03);backdrop-filter:blur(8px)}
.pm-login-features span{color:#A65A2A;font-size:.7rem}.pm-login-features b{color:#b4b4bd;font-size:.68rem;font-weight:650}.pm-login-features small{margin-left:auto;color:#494952;font-size:.48rem}
.pm-login-footer{display:flex;align-items:center;gap:1rem;color:#4d4d57;font-size:.62rem}.pm-login-footer a:hover{color:#fff}

.pm-login-mobile{
 position:relative;
 height:210px;
 margin:-1.5rem -1.5rem 1.5rem;
 overflow:hidden;
 isolation:isolate;
 border-bottom:1px solid rgba(255,255,255,.06);
 background:linear-gradient(145deg,#111514 0%,#0a0a0c 60%,#201910 100%);
}
.pm-login-mobile-grid{
 position:absolute;left:-22%;right:-30%;top:38%;bottom:-65%;
 transform:rotateX(66deg) rotateZ(-8deg);
 transform-origin:center top;
 background-image:linear-gradient(rgba(255,255,255,.055) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.055) 1px,transparent 1px);
 background-size:32px 32px;
 mask-image:linear-gradient(to bottom,#000,transparent 78%);
 opacity:.55;
}
.pm-login-mobile-glow{position:absolute;width:230px;height:230px;right:-72px;top:-70px;border-radius:50%;background:#A65A2A;filter:blur(55px);opacity:.24}
.pm-login-mobile-orbit{position:absolute;width:230px;height:230px;right:-60px;top:-4px;border:1px solid rgba(196,138,58,.3);border-radius:50%;transform:rotateX(72deg) rotateZ(10deg);animation:pm-login-mobile-orbit 12s linear infinite}
.pm-login-mobile-object{position:absolute;right:28px;top:24px;width:105px;height:130px;animation:pm-login-float 5s ease-in-out infinite}
.pm-login-mobile-object-face,.pm-login-mobile-object-screen{position:absolute;inset:0;border-radius:24px}
.pm-login-mobile-object-face{background:linear-gradient(145deg,rgba(255,255,255,.17),transparent 20%),linear-gradient(145deg,#38271e,#141818 53%,#08080b);border:1px solid rgba(255,255,255,.16);box-shadow:inset -12px -12px 30px rgba(0,0,0,.42),18px 22px 50px rgba(0,0,0,.4);transform:rotateX(-6deg) rotateY(-22deg)}
.pm-login-mobile-object-screen{inset:12px;display:grid;place-items:center;border:1px solid rgba(255,255,255,.08);background:radial-gradient(circle,rgba(166,90,42,.18),transparent 58%);transform:translateZ(16px) rotateX(-6deg) rotateY(-22deg)}
.pm-login-mobile-object-screen img{height:44px;width:40px;object-fit:contain;filter:drop-shadow(0 4px 10px rgba(0,0,0,.4))}
.pm-login-mobile-copy{position:absolute;z-index:2;left:1.25rem;right:138px;top:50%;transform:translateY(-50%)}
.pm-login-mobile-copy p{margin:0 0 .55rem;color:#DFA269;font-size:.48rem;font-weight:800;letter-spacing:.13em}
.pm-login-mobile-copy h2{margin:0;color:#f2f2f4;font-size:1.75rem;line-height:.9;letter-spacing:-.045em;font-weight:900}
.pm-login-mobile-copy h2 b{color:#A65A2A}
@keyframes pm-login-mobile-orbit{to{transform:rotateX(72deg) rotateZ(370deg)}}
@media(max-width:390px){
 .pm-login-mobile{height:188px}
 .pm-login-mobile-object{right:14px;top:20px;transform:scale(.9)}
 .pm-login-mobile-copy{right:116px;left:1rem}
 .pm-login-mobile-copy h2{font-size:1.48rem}
}
@keyframes pm-login-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-14px)}}
@keyframes pm-login-orbit-a{to{transform:translateY(-50%) rotateX(72deg) rotateZ(372deg)}}
@keyframes pm-login-orbit-b{to{transform:translateY(-50%) rotateY(72deg) rotateZ(395deg)}}
@keyframes pm-login-particle{0%,100%{opacity:.08;transform:translateY(0) scale(.7)}50%{opacity:.32;transform:translateY(-16px) scale(1.2)}}
@media(max-width:1180px){.pm-login-object-zone{right:-10%;opacity:.65}.pm-login-copy{max-width:460px}.pm-login-content{padding:2.4rem}}
@media(prefers-reduced-motion:reduce){.pm-login-object,.pm-login-orbit,.pm-login-particles i,.pm-login-mobile-orbit,.pm-login-mobile-object{animation:none!important}.pm-login-object-zone{transition:none}}
`

import { useEffect, useState, type CSSProperties, type PointerEvent } from 'react'
import { Link } from 'react-router-dom'
import { trackConversion } from '../../lib/analytics'

type LabMode = {
  key: 'tech' | 'design' | 'studio' | 'ai'
  label: string
  eyebrow: string
  title: string
  copy: string
  cta: string
  href: string
  accent: string
  symbol: string
}

const LAB_MODES: LabMode[] = [
  {
    key: 'tech',
    label: 'Tech',
    eyebrow: 'Sites · sistemas · automações',
    title: 'Transforme uma ideia em produto digital.',
    copy: 'Experiências web, plataformas, tecnologia e fluxos que conectam operação, conteúdo e negócio.',
    cta: 'Explorar Tech',
    href: '/tech',
    accent: '#2E5D46',
    symbol: '</>',
  },
  {
    key: 'design',
    label: 'Design',
    eyebrow: 'Marca · interface · comunicação',
    title: 'Dê forma, presença e clareza para a sua marca.',
    copy: 'Identidade visual e design digital pensados para funcionar em cada ponto de contato.',
    cta: 'Explorar Design',
    href: '/design',
    accent: '#A65A2A',
    symbol: '◆',
  },
  {
    key: 'studio',
    label: 'Studio',
    eyebrow: 'Vídeo · foto · áudio · criação',
    title: 'Leve a sua história para imagem e movimento.',
    copy: 'Produção audiovisual e conteúdo com direção visual, ritmo e acabamento profissional.',
    cta: 'Explorar Studio',
    href: '/studio',
    accent: '#C48A3A',
    symbol: '●',
  },
  {
    key: 'ai',
    label: 'IA',
    eyebrow: 'Criação · produtividade · experimentação',
    title: 'Use inteligência artificial como ferramenta de criação.',
    copy: 'Prototipação, automações e experiências generativas aplicadas a projetos reais.',
    cta: 'Conhecer soluções',
    href: '/servicos',
    accent: '#93704E',
    symbol: '✦',
  },
]

const PARTICLES = Array.from({ length: 34 }, (_, index) => ({
  id: index,
  x: 4 + ((index * 29) % 92),
  y: 7 + ((index * 41) % 84),
  size: 2 + (index % 5),
  delay: (index % 8) * 45,
}))

type Props={
 accent?:string
 clientHref?:string
 quoteHref?:string
 academyHref?:string
}

export function PlayLabExperience({
 accent='#A65A2A',
 clientHref='/login?next=%2Fapp%2Fdashboard',
 quoteHref='/servicos',
 academyHref='/academia',
}:Props) {
  const [activeKey, setActiveKey] = useState<LabMode['key']>('tech')
  const [tilt, setTilt] = useState({ x: 0, y: 0 })
  const [burst, setBurst] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)
  const active = LAB_MODES.find(mode => mode.key === activeKey) ?? LAB_MODES[0]

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => setReducedMotion(media.matches)
    sync()
    media.addEventListener?.('change', sync)
    return () => media.removeEventListener?.('change', sync)
  }, [])

  function selectMode(mode: LabMode) {
    if (mode.key === activeKey) return
    setActiveKey(mode.key)
    if (!reducedMotion) {
      setBurst(false)
      window.requestAnimationFrame(() => {
        setBurst(true)
        window.setTimeout(() => setBurst(false), 620)
      })
    }
  }

  function onPointerMove(event: PointerEvent<HTMLElement>) {
    if (reducedMotion || event.pointerType === 'touch') return
    const rect = event.currentTarget.getBoundingClientRect()
    const x = (event.clientX - rect.left) / rect.width - 0.5
    const y = (event.clientY - rect.top) / rect.height - 0.5
    setTilt({ x: x * 11, y: y * -8 })
  }

  const style = {
    '--pm-lab-accent': active.accent || accent,
    '--pm-lab-tilt-x': `${tilt.y}deg`,
    '--pm-lab-tilt-y': `${tilt.x}deg`,
  } as CSSProperties

  const quickActions=[
    {label:'Serviços',caption:'Criar e contratar',href:'/servicos',event:'service_interest' as const},
    {label:'Produtos & equipamentos',caption:'Comprar ou alugar',href:'/produtos',event:'product_interest' as const},
    {label:'Academia',caption:'Aprender gratuitamente',href:academyHref,event:'academy_interest' as const},
    {label:'Minha área',caption:'Acompanhar projetos',href:clientHref,event:'account_interest' as const},
  ]

  return (
    <section
      className="pm-lab-hero"
      style={style}
      onPointerMove={onPointerMove}
      onPointerLeave={()=>setTilt({x:0,y:0})}
      onPointerCancel={()=>setTilt({x:0,y:0})}
      aria-labelledby="play-lab-title"
    >
      <style>{PLAY_LAB_STYLES}</style>

      <div className="pm-lab-background" aria-hidden="true">
        <div className="pm-lab-aurora pm-lab-aurora-a"/>
        <div className="pm-lab-aurora pm-lab-aurora-b"/>
        <div className="pm-lab-grid"/>
        <div className="pm-lab-horizon"/>
        <div className="pm-lab-word pm-lab-word-top">SAGA</div>
        <div className="pm-lab-word pm-lab-word-bottom">MENTE</div>
        <div className="pm-lab-orbit pm-lab-orbit-a"/>
        <div className="pm-lab-orbit pm-lab-orbit-b"/>
        <div className={`pm-lab-particles ${burst?'is-bursting':''}`}>
          {PARTICLES.map(p=><i key={p.id} style={{left:`${p.x}%`,top:`${p.y}%`,width:p.size,height:p.size,animationDelay:`${p.delay}ms`}}/>)}
        </div>

        <div className="pm-lab-object-zone">
          <div className={`pm-lab-object pm-lab-object--${active.key} ${burst?'is-switching':''}`}>
            <div className="pm-lab-object-core">
              <div className="pm-lab-face pm-lab-face-front"/>
              <div className="pm-lab-face pm-lab-face-back"/>
              <div className="pm-lab-face pm-lab-face-side"/>
              <div className="pm-lab-screen">
                <span>{active.symbol}</span>
                <small>{active.label}</small>
              </div>
            </div>
            <div className="pm-lab-shadow"/>
          </div>
        </div>

        <div className="pm-lab-float-card pm-lab-float-card-a">
          <span>MODE</span><b>{active.label.toUpperCase()}</b>
        </div>
        <div className="pm-lab-float-card pm-lab-float-card-b">
          <span>SAGA LAB</span><b>0{LAB_MODES.findIndex(mode=>mode.key===active.key)+1} / 04</b>
        </div>
      </div>

      <div className="pm-lab-vignette" aria-hidden="true"/>

      <div className="pm-lab-content">
        <div className="pm-lab-topline">
          <span>SAGAMENTE / EXPERIENCE LAB</span>
          <span>CRIAR · CONECTAR · TRANSFORMAR</span>
        </div>

        <div className="pm-lab-maincopy">
          <p className="pm-lab-kicker">CRIAÇÃO + TECNOLOGIA + CONHECIMENTO</p>
          <h1 id="play-lab-title">
            Ideias inteligentes.
            <span> Soluções que transformam.</span>
          </h1>
          <p className="pm-lab-lead">
            Design, tecnologia, comunicação e cultura. Da ideia à realização, com soluções para criar, contratar, aprender e acompanhar.
          </p>

          <div className="pm-lab-tabs" role="tablist" aria-label="Explorar áreas da Sagamente">
            {LAB_MODES.map(mode=><button
              key={mode.key}
              type="button"
              role="tab"
              aria-selected={active.key===mode.key}
              className={active.key===mode.key?'is-active':''}
              onClick={()=>selectMode(mode)}
            ><span className="pm-lab-tab-index">0{LAB_MODES.indexOf(mode)+1}</span>{mode.label}</button>)}
          </div>

          <div className="pm-lab-active" aria-live="polite">
            <p>{active.eyebrow}</p>
            <h2>{active.title}</h2>
            <span>{active.copy}</span>
            <div className="pm-lab-actions">
              <Link to={active.href} onClick={()=>trackConversion('service_interest',{source:'home_play_lab',area:active.key})} className="pm-lab-primary">
                {active.cta} <b aria-hidden="true">↗</b>
              </Link>
              <Link to={quoteHref} className="pm-lab-link">Preciso de algo personalizado</Link>
            </div>
          </div>
        </div>

        <div className="pm-lab-quickbar">
          {quickActions.map((item,index)=><Link
            key={item.label}
            to={item.href}
            onClick={()=>trackConversion(item.event,{source:'home_immersive_hero'})}
            className="pm-lab-quickitem"
          >
            <span className="pm-lab-quickindex">0{index+1}</span>
            <span className="pm-lab-quicktext"><b>{item.label}</b><small>{item.caption}</small></span>
            <span className="pm-lab-arrow" aria-hidden="true">↗</span>
          </Link>)}
        </div>
      </div>
    </section>
  )
}

const PLAY_LAB_STYLES = `
.pm-lab-hero{
 --pm-lab-accent:#A65A2A;
 --pm-lab-tilt-x:0deg;
 --pm-lab-tilt-y:0deg;
 position:relative;
 min-height:min(940px,calc(100svh - 64px));
 height:auto;
 overflow:hidden;
 isolation:isolate;
 border-bottom:1px solid rgba(255,255,255,.07);
 background:#080809;
 perspective:1400px;
}
.pm-lab-background{position:absolute;inset:0;overflow:hidden;pointer-events:none;transform-style:preserve-3d}
.pm-lab-vignette{position:absolute;inset:0;z-index:1;pointer-events:none;background:linear-gradient(90deg,rgba(8,8,9,.98) 0%,rgba(8,8,9,.9) 34%,rgba(8,8,9,.3) 62%,rgba(8,8,9,.66) 100%),linear-gradient(0deg,#080809 0%,transparent 24%,transparent 78%,rgba(8,8,9,.72) 100%)}
.pm-lab-aurora{position:absolute;border-radius:50%;filter:blur(85px);opacity:.24}
.pm-lab-aurora-a{width:52vw;height:52vw;right:-5vw;top:-14vw;background:var(--pm-lab-accent);transition:background .45s ease}
.pm-lab-aurora-b{width:34vw;height:34vw;right:20vw;bottom:-18vw;background:color-mix(in srgb,var(--pm-lab-accent) 55%,#C48A3A);opacity:.15}
.pm-lab-grid{position:absolute;left:35%;right:-25%;top:43%;bottom:-42%;transform:rotateX(64deg) rotateZ(-7deg);transform-origin:center top;background-image:linear-gradient(rgba(255,255,255,.055) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.055) 1px,transparent 1px);background-size:54px 54px;mask-image:linear-gradient(to bottom,black,transparent 78%);opacity:.58}
.pm-lab-horizon{position:absolute;left:31%;right:0;top:63%;height:1px;background:linear-gradient(90deg,transparent,var(--pm-lab-accent),transparent);box-shadow:0 0 42px var(--pm-lab-accent);opacity:.58}
.pm-lab-word{position:absolute;right:-.02em;font-size:clamp(7rem,18vw,17rem);font-weight:900;line-height:.78;letter-spacing:-.075em;color:transparent;-webkit-text-stroke:1px rgba(255,255,255,.045);white-space:nowrap}
.pm-lab-word-top{top:4%}.pm-lab-word-bottom{bottom:12%;right:-4%}
.pm-lab-orbit{position:absolute;right:8%;top:48%;border:1px solid color-mix(in srgb,var(--pm-lab-accent) 45%,transparent);border-radius:50%;transform-style:preserve-3d}
.pm-lab-orbit-a{width:min(48vw,610px);aspect-ratio:1;transform:translateY(-50%) rotateX(72deg) rotateZ(12deg);animation:pm-orbit-a 16s linear infinite}
.pm-lab-orbit-b{width:min(34vw,440px);aspect-ratio:1;right:15%;transform:translateY(-50%) rotateY(74deg) rotateZ(42deg);opacity:.45;animation:pm-orbit-b 12s linear infinite reverse}
.pm-lab-object-zone{position:absolute;right:5%;top:12%;width:min(55vw,720px);height:72%;display:grid;place-items:center;transform:rotateX(var(--pm-lab-tilt-x)) rotateY(var(--pm-lab-tilt-y));transition:transform .14s ease-out;transform-style:preserve-3d}
.pm-lab-object{position:relative;width:360px;height:430px;transform-style:preserve-3d;animation:pm-float 5.4s ease-in-out infinite}
.pm-lab-object-core{position:absolute;left:50%;top:47%;width:270px;height:335px;transform:translate(-50%,-50%) rotateX(-8deg) rotateY(-25deg);transform-style:preserve-3d;border-radius:46px;transition:all .5s cubic-bezier(.2,.8,.2,1)}
.pm-lab-face,.pm-lab-screen{position:absolute;inset:0;border-radius:inherit;backface-visibility:hidden}
.pm-lab-face-front{background:linear-gradient(145deg,rgba(255,255,255,.23),transparent 19%),linear-gradient(145deg,color-mix(in srgb,var(--pm-lab-accent) 42%,#24242c),#111116 52%,#060608);border:1px solid rgba(255,255,255,.2);box-shadow:inset 0 1px rgba(255,255,255,.24),inset -28px -30px 70px rgba(0,0,0,.43),32px 45px 100px rgba(0,0,0,.55);transform:translateZ(28px)}
.pm-lab-face-back{background:#070709;border:1px solid rgba(255,255,255,.07);transform:translateZ(-28px) rotateY(180deg)}
.pm-lab-face-side{inset:12px -28px 12px auto;width:56px;border-radius:12px;background:linear-gradient(90deg,#08080b,color-mix(in srgb,var(--pm-lab-accent) 38%,#17171d));transform-origin:left center;transform:rotateY(90deg)}
.pm-lab-screen{inset:24px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1rem;border:1px solid rgba(255,255,255,.11);background:radial-gradient(circle at 50% 42%,color-mix(in srgb,var(--pm-lab-accent) 25%,transparent),transparent 43%),linear-gradient(180deg,rgba(255,255,255,.035),rgba(0,0,0,.2));transform:translateZ(30px)}
.pm-lab-screen>span{display:grid;place-items:center;width:112px;height:112px;border-radius:34px;border:1px solid color-mix(in srgb,var(--pm-lab-accent) 60%,transparent);background:color-mix(in srgb,var(--pm-lab-accent) 13%,transparent);box-shadow:0 0 70px color-mix(in srgb,var(--pm-lab-accent) 26%,transparent);font-size:2.2rem;font-weight:900;color:white;letter-spacing:-.08em}
.pm-lab-screen small{font-size:.68rem;font-weight:800;letter-spacing:.26em;color:rgba(255,255,255,.55)}
.pm-lab-shadow{position:absolute;left:50%;bottom:0;width:270px;height:52px;transform:translateX(-50%) rotateX(76deg);border-radius:50%;background:color-mix(in srgb,var(--pm-lab-accent) 32%,#000);filter:blur(24px);opacity:.58}
.pm-lab-object--design .pm-lab-object-core{width:305px;height:305px;border-radius:84px 32px 84px 32px;transform:translate(-50%,-50%) rotateX(-8deg) rotateY(-28deg) rotateZ(8deg)}
.pm-lab-object--studio .pm-lab-object-core{width:325px;height:235px;border-radius:42px}
.pm-lab-object--studio .pm-lab-screen{inset:22px 58px 22px 22px}
.pm-lab-object--ai .pm-lab-object-core{width:285px;height:285px;border-radius:50%;transform:translate(-50%,-50%) rotateX(-11deg) rotateY(-24deg)}
.pm-lab-object--ai .pm-lab-face,.pm-lab-object--ai .pm-lab-screen{border-radius:50%}.pm-lab-object--ai .pm-lab-face-side{display:none}
.pm-lab-object.is-switching .pm-lab-object-core{animation:pm-switch .6s cubic-bezier(.2,.8,.2,1)}
.pm-lab-particles{position:absolute;inset:0}.pm-lab-particles i{position:absolute;border-radius:50%;background:var(--pm-lab-accent);box-shadow:0 0 16px var(--pm-lab-accent);opacity:.12}.pm-lab-particles.is-bursting i{animation:pm-particle .6s ease-out both}
.pm-lab-float-card{position:absolute;right:4%;z-index:2;min-width:150px;padding:.85rem 1rem;border:1px solid rgba(255,255,255,.1);background:rgba(10,10,12,.42);backdrop-filter:blur(14px);border-radius:14px;display:flex;align-items:center;justify-content:space-between;gap:1rem;box-shadow:0 16px 50px rgba(0,0,0,.24)}
.pm-lab-float-card span{font-size:.56rem;letter-spacing:.15em;color:#6f6f7b}.pm-lab-float-card b{font-size:.68rem;color:#e6e6ea}
.pm-lab-float-card-a{top:18%}.pm-lab-float-card-b{bottom:23%;right:20%}

.pm-lab-content{position:relative;z-index:3;max-width:1200px;min-height:min(940px,calc(100svh - 64px));margin:0 auto;padding:1.25rem 1.4rem 10.5rem;display:flex;flex-direction:column}
.pm-lab-topline{display:flex;justify-content:space-between;gap:1rem;padding-top:.4rem;color:#54545f;font-size:.56rem;font-weight:700;letter-spacing:.16em}
.pm-lab-maincopy{margin-top:auto;margin-bottom:auto;max-width:650px;padding:4rem 0 2rem}
.pm-lab-kicker{margin:0 0 1rem;color:#C48A3A;font-size:.68rem;font-weight:800;letter-spacing:.18em}
.pm-lab-maincopy h1{margin:0;max-width:670px;font-size:clamp(3.5rem,7.2vw,6.8rem);line-height:.85;letter-spacing:-.065em;font-weight:900;color:#f5f5f7}
.pm-lab-maincopy h1 span{display:block;color:color-mix(in srgb,var(--pm-lab-accent) 55%,white);text-shadow:0 0 54px color-mix(in srgb,var(--pm-lab-accent) 20%,transparent)}
.pm-lab-lead{max-width:560px;margin:1.5rem 0 0;color:#8c8c98;font-size:clamp(.95rem,1.45vw,1.08rem);line-height:1.6}
.pm-lab-tabs{display:flex;gap:.45rem;margin-top:1.65rem;flex-wrap:wrap}
.pm-lab-tabs button{display:flex;align-items:center;gap:.48rem;min-height:42px;padding:.6rem .82rem;border:1px solid rgba(255,255,255,.09);border-radius:999px;background:rgba(255,255,255,.025);color:#72727e;font:inherit;font-size:.75rem;font-weight:800}
.pm-lab-tabs button:hover{color:white;border-color:rgba(255,255,255,.2)}.pm-lab-tabs button.is-active{color:white;background:color-mix(in srgb,var(--pm-lab-accent) 13%,transparent);border-color:color-mix(in srgb,var(--pm-lab-accent) 60%,transparent);box-shadow:0 0 28px color-mix(in srgb,var(--pm-lab-accent) 12%,transparent)}
.pm-lab-tab-index{font-size:.56rem;color:#5e5e68}.pm-lab-tabs button.is-active .pm-lab-tab-index{color:color-mix(in srgb,var(--pm-lab-accent) 55%,white)}
.pm-lab-active{max-width:520px;margin-top:1.4rem;padding-left:1rem;border-left:2px solid var(--pm-lab-accent)}
.pm-lab-active>p{margin:0;color:#b1b1bb;font-size:.68rem;font-weight:700;text-transform:uppercase;letter-spacing:.09em}.pm-lab-active h2{margin:.45rem 0 0;color:#f4f4f6;font-size:clamp(1.35rem,2vw,1.75rem);line-height:1.08}.pm-lab-active>span{display:block;margin-top:.65rem;color:#7e7e8a;font-size:.88rem;line-height:1.5}
.pm-lab-actions{display:flex;align-items:center;gap:1rem;margin-top:1rem;flex-wrap:wrap}.pm-lab-primary{display:inline-flex;align-items:center;gap:.55rem;min-height:44px;padding:.7rem 1rem;border-radius:999px;background:var(--pm-lab-accent);color:#fff;font-size:.78rem;font-weight:800;box-shadow:0 12px 34px color-mix(in srgb,var(--pm-lab-accent) 18%,transparent)}.pm-lab-primary:hover{transform:translateY(-2px)}.pm-lab-link{font-size:.78rem;font-weight:700;color:#a0a0aa;text-decoration:underline;text-underline-offset:4px}
.pm-lab-quickbar{position:absolute;left:1.4rem;right:1.4rem;bottom:1.3rem;display:grid;grid-template-columns:repeat(4,1fr);border:1px solid rgba(255,255,255,.08);border-radius:22px;background:rgba(14,14,16,.68);backdrop-filter:blur(20px);overflow:hidden;box-shadow:0 30px 80px rgba(0,0,0,.35)}
.pm-lab-quickitem{min-width:0;min-height:88px;padding:1rem;display:flex;align-items:center;gap:.75rem;border-right:1px solid rgba(255,255,255,.07);color:#eeeef2}.pm-lab-quickitem:last-child{border-right:0}.pm-lab-quickitem:hover{background:rgba(255,255,255,.055)}.pm-lab-quickindex{font-size:.58rem;color:#50505a}.pm-lab-quicktext{min-width:0;display:flex;flex-direction:column}.pm-lab-quicktext b{font-size:.82rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.pm-lab-quicktext small{margin-top:.18rem;font-size:.66rem;color:#6e6e79;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.pm-lab-arrow{margin-left:auto;color:var(--pm-lab-accent)}

@keyframes pm-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-18px)}}
@keyframes pm-orbit-a{to{transform:translateY(-50%) rotateX(72deg) rotateZ(372deg)}}@keyframes pm-orbit-b{to{transform:translateY(-50%) rotateY(74deg) rotateZ(402deg)}}
@keyframes pm-switch{0%{opacity:1;filter:blur(0)}42%{opacity:.15;filter:blur(13px);transform:translate(-50%,-50%) rotateX(30deg) rotateY(105deg) scale(.55)}100%{opacity:1;filter:blur(0)}}
@keyframes pm-particle{0%{opacity:.15;transform:scale(.3)}45%{opacity:.95;transform:translateY(-22px) scale(1.8)}100%{opacity:0;transform:translateY(-70px) scale(.2)}}

@media(max-width:950px){
 .pm-lab-hero,.pm-lab-content{min-height:860px}
 .pm-lab-vignette{background:linear-gradient(0deg,#080809 0%,rgba(8,8,9,.95) 42%,rgba(8,8,9,.3) 73%,rgba(8,8,9,.62) 100%)}
 .pm-lab-object-zone{right:-7%;top:-3%;width:114%;height:48%;opacity:.75;transform:scale(.72) rotateX(var(--pm-lab-tilt-x)) rotateY(var(--pm-lab-tilt-y))}
 .pm-lab-grid{left:-26%;right:-26%;top:31%}.pm-lab-orbit{right:8%;top:25%}.pm-lab-float-card{display:none}
 .pm-lab-maincopy{margin-top:300px;margin-bottom:0;padding:1rem 0 1.5rem;max-width:720px}
 .pm-lab-maincopy h1{font-size:clamp(3rem,11vw,5rem)}
 .pm-lab-lead{max-width:620px}
 .pm-lab-quickbar{grid-template-columns:1fr 1fr}.pm-lab-quickitem:nth-child(2){border-right:0}.pm-lab-quickitem:nth-child(-n+2){border-bottom:1px solid rgba(255,255,255,.07)}
 .pm-lab-content{padding-bottom:12.5rem}
}
@media(max-width:600px){
 .pm-lab-hero,.pm-lab-content{min-height:820px}
 .pm-lab-hero{perspective:900px}
 .pm-lab-content{padding:.8rem .85rem 11.6rem}
 .pm-lab-topline{font-size:.48rem;letter-spacing:.11em}.pm-lab-topline span:last-child{display:none}
 .pm-lab-object-zone{top:-4%;right:-34%;width:168%;height:43%;opacity:.7;transform:scale(.52) rotateX(var(--pm-lab-tilt-x)) rotateY(var(--pm-lab-tilt-y))}
 .pm-lab-orbit{top:21%}.pm-lab-orbit-a{width:430px;right:-54%}.pm-lab-orbit-b{width:290px;right:-12%}
 .pm-lab-word{font-size:7rem;opacity:.65}.pm-lab-word-top{top:3%}.pm-lab-word-bottom{display:none}
 .pm-lab-maincopy{margin-top:246px;padding:.65rem 0 1rem}
 .pm-lab-kicker{margin-bottom:.65rem;font-size:.53rem;letter-spacing:.13em}
 .pm-lab-maincopy h1{font-size:clamp(2.65rem,13.5vw,3.8rem);line-height:.88}
 .pm-lab-lead{margin-top:1rem;font-size:.84rem;line-height:1.5}
 .pm-lab-tabs{display:flex;gap:.35rem;width:calc(100% + 1.7rem);margin-left:-.85rem;padding:0 .85rem .25rem;overflow-x:auto;scrollbar-width:none;overscroll-behavior-inline:contain;scroll-snap-type:x proximity}
 .pm-lab-tabs::-webkit-scrollbar{display:none}
 .pm-lab-tabs button{flex:0 0 auto;min-width:78px;min-height:42px;justify-content:center;padding:.52rem .72rem;scroll-snap-align:start}
 .pm-lab-tab-index{display:none}
 .pm-lab-active{margin-top:.9rem;padding-left:.8rem}
 .pm-lab-active>p{font-size:.58rem;letter-spacing:.07em}
 .pm-lab-active h2{font-size:1.18rem;line-height:1.12}
 .pm-lab-active>span{display:none}
 .pm-lab-actions{display:grid;grid-template-columns:1fr;gap:.6rem;margin-top:.8rem}
 .pm-lab-primary{width:100%;min-height:46px;justify-content:center;border-radius:14px}
 .pm-lab-link{display:flex;min-height:42px;align-items:center;justify-content:center;text-align:center}
 .pm-lab-quickbar{left:.75rem;right:.75rem;bottom:.75rem;border-radius:17px}
 .pm-lab-quickitem{min-height:70px;padding:.66rem .7rem;gap:.45rem}
 .pm-lab-quickindex{display:none}.pm-lab-quicktext b{font-size:.68rem}.pm-lab-quicktext small{font-size:.54rem}.pm-lab-arrow{font-size:.75rem}
}
@media(max-width:390px){
 .pm-lab-hero,.pm-lab-content{min-height:850px}
 .pm-lab-maincopy{margin-top:235px}
 .pm-lab-maincopy h1{font-size:2.55rem}
 .pm-lab-quicktext small{display:none}
 .pm-lab-quickitem{min-height:62px}
}
@media(prefers-reduced-motion:reduce){.pm-lab-object,.pm-lab-orbit,.pm-lab-particles i,.pm-lab-object.is-switching .pm-lab-object-core{animation:none!important}.pm-lab-object-zone{transition:none}}
`

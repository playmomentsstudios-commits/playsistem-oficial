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
}

const LAB_MODES: LabMode[] = [
  {
    key: 'tech',
    label: 'Tech',
    eyebrow: 'Sites · sistemas · automações',
    title: 'Transforme uma ideia em produto digital.',
    copy: 'Experiências web, plataformas e fluxos que conectam operação, conteúdo e negócio.',
    cta: 'Explorar Tech',
    href: '/tech',
    accent: '#ff3947',
  },
  {
    key: 'design',
    label: 'Design',
    eyebrow: 'Marca · interface · comunicação',
    title: 'Dê forma, presença e clareza para a sua marca.',
    copy: 'Identidade visual e design digital pensados para funcionar em cada ponto de contato.',
    cta: 'Explorar Design',
    href: '/design',
    accent: '#ff6f3d',
  },
  {
    key: 'studio',
    label: 'Studio',
    eyebrow: 'Vídeo · foto · áudio · criação',
    title: 'Leve a sua história para imagem e movimento.',
    copy: 'Produção audiovisual e conteúdo com direção visual, ritmo e acabamento profissional.',
    cta: 'Explorar Studio',
    href: '/studio',
    accent: '#8c6cff',
  },
  {
    key: 'ai',
    label: 'IA',
    eyebrow: 'Criação · produtividade · experimentação',
    title: 'Use inteligência artificial como ferramenta de criação.',
    copy: 'Prototipação, automações e experiências generativas aplicadas a projetos reais.',
    cta: 'Conhecer soluções',
    href: '/servicos',
    accent: '#33c7d6',
  },
]

const PARTICLES = Array.from({ length: 22 }, (_, index) => ({
  id: index,
  x: 12 + ((index * 29) % 78),
  y: 14 + ((index * 41) % 68),
  size: 3 + (index % 4),
  delay: (index % 7) * 55,
}))

export function PlayLabExperience({ accent = '#E30613' }: { accent?: string }) {
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

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (reducedMotion || event.pointerType === 'touch') return
    const rect = event.currentTarget.getBoundingClientRect()
    const x = (event.clientX - rect.left) / rect.width - 0.5
    const y = (event.clientY - rect.top) / rect.height - 0.5
    setTilt({ x: x * 9, y: y * -7 })
  }

  function resetTilt() {
    setTilt({ x: 0, y: 0 })
  }

  const stageStyle = {
    '--pm-lab-accent': active.accent || accent,
    '--pm-lab-tilt-x': `${tilt.y}deg`,
    '--pm-lab-tilt-y': `${tilt.x}deg`,
  } as CSSProperties

  return (
    <section className="pm-lab-shell" aria-labelledby="play-lab-title">
      <style>{PLAY_LAB_STYLES}</style>
      <div className="pm-lab-wrap">
        <div className="pm-lab-copy">
          <p className="pm-lab-kicker">PLAY LAB · EXPERIÊNCIA INTERATIVA</p>
          <h2 id="play-lab-title">
            Ideias entram em cena.
            <span> Projetos ganham forma.</span>
          </h2>
          <p className="pm-lab-intro">
            Explore as áreas da Play Moments e veja a experiência se transformar. Mova o cursor sobre a cena ou toque nas categorias.
          </p>

          <div className="pm-lab-tabs" role="tablist" aria-label="Áreas da Play Moments">
            {LAB_MODES.map(mode => (
              <button
                key={mode.key}
                type="button"
                role="tab"
                aria-selected={activeKey === mode.key}
                className={activeKey === mode.key ? 'is-active' : ''}
                onClick={() => selectMode(mode)}
              >
                <span>{mode.label}</span>
              </button>
            ))}
          </div>

          <div className="pm-lab-detail" aria-live="polite">
            <p className="pm-lab-eyebrow">{active.eyebrow}</p>
            <h3>{active.title}</h3>
            <p>{active.copy}</p>
            <div className="pm-lab-actions">
              <Link
                to={active.href}
                onClick={() => trackConversion('service_interest', { source: 'home_play_lab', area: active.key })}
                className="pm-lab-primary"
              >
                {active.cta}
                <span aria-hidden="true">↗</span>
              </Link>
              <Link to="/servicos" className="pm-lab-secondary">
                Ver todos os serviços
              </Link>
            </div>
          </div>
        </div>

        <div
          className="pm-lab-stage"
          style={stageStyle}
          onPointerMove={onPointerMove}
          onPointerLeave={resetTilt}
          onPointerCancel={resetTilt}
          aria-label={`Visual interativo da área ${active.label}`}
        >
          <div className="pm-lab-grid" aria-hidden="true" />
          <div className="pm-lab-glow" aria-hidden="true" />
          <div className="pm-lab-orbit pm-lab-orbit-one" aria-hidden="true" />
          <div className="pm-lab-orbit pm-lab-orbit-two" aria-hidden="true" />

          <div className={`pm-lab-particles ${burst ? 'is-bursting' : ''}`} aria-hidden="true">
            {PARTICLES.map(particle => (
              <i
                key={particle.id}
                style={{
                  left: `${particle.x}%`,
                  top: `${particle.y}%`,
                  width: particle.size,
                  height: particle.size,
                  animationDelay: `${particle.delay}ms`,
                }}
              />
            ))}
          </div>

          <div className="pm-lab-object-wrap" aria-hidden="true">
            <div className={`pm-lab-object pm-lab-object--${active.key} ${burst ? 'is-switching' : ''}`}>
              <div className="pm-lab-object-core">
                <div className="pm-lab-object-face pm-lab-object-face-front" />
                <div className="pm-lab-object-face pm-lab-object-face-back" />
                <div className="pm-lab-object-face pm-lab-object-face-side" />
                <div className="pm-lab-object-screen">
                  <span className="pm-lab-object-mark">
                    {active.key === 'tech' && '</>'}
                    {active.key === 'design' && '◆'}
                    {active.key === 'studio' && '●'}
                    {active.key === 'ai' && '✦'}
                  </span>
                  <small>{active.label}</small>
                </div>
              </div>
              <div className="pm-lab-object-shadow" />
            </div>
          </div>

          <div className="pm-lab-hud pm-lab-hud-top" aria-hidden="true">
            <span>PLAY MOMENTS / LAB</span>
            <span>0{LAB_MODES.findIndex(mode => mode.key === active.key) + 1}</span>
          </div>
          <div className="pm-lab-hud pm-lab-hud-bottom" aria-hidden="true">
            <span>INTERACTIVE EXPERIENCE</span>
            <span>MOVE / TOUCH</span>
          </div>
        </div>
      </div>
    </section>
  )
}

const PLAY_LAB_STYLES = `
.pm-lab-shell {
  position: relative;
  padding: 2.5rem 1.25rem 4rem;
  overflow: hidden;
}
.pm-lab-shell::before {
  content: "";
  position: absolute;
  inset: 8% auto auto 50%;
  width: min(78vw, 900px);
  height: 340px;
  transform: translateX(-50%);
  border-radius: 999px;
  background: radial-gradient(circle, rgba(227, 6, 19, .1), transparent 70%);
  filter: blur(28px);
  pointer-events: none;
}
.pm-lab-wrap {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: minmax(0, .82fr) minmax(430px, 1.18fr);
  gap: clamp(2rem, 5vw, 5rem);
  align-items: center;
  max-width: 1180px;
  margin: 0 auto;
}
.pm-lab-copy { min-width: 0; }
.pm-lab-kicker {
  margin: 0 0 .9rem;
  color: #ff5f69;
  font-size: .69rem;
  line-height: 1.4;
  font-weight: 700;
  letter-spacing: .18em;
}
.pm-lab-copy > h2 {
  margin: 0;
  max-width: 700px;
  color: #f5f5f7;
  font-size: clamp(2rem, 4.3vw, 4rem);
  line-height: .98;
  letter-spacing: -.045em;
  font-weight: 800;
}
.pm-lab-copy > h2 span { color: #E30613; }
.pm-lab-intro {
  max-width: 590px;
  margin: 1.25rem 0 0;
  color: #858592;
  font-size: clamp(.94rem, 1.35vw, 1.05rem);
  line-height: 1.65;
}
.pm-lab-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: .5rem;
  margin-top: 1.6rem;
}
.pm-lab-tabs button {
  min-height: 42px;
  padding: .62rem .9rem;
  border: 1px solid rgba(255,255,255,.09);
  border-radius: 999px;
  background: rgba(255,255,255,.025);
  color: #777783;
  font: inherit;
  font-size: .78rem;
  font-weight: 700;
}
.pm-lab-tabs button:hover {
  color: #f2f2f4;
  border-color: rgba(255,255,255,.2);
}
.pm-lab-tabs button.is-active {
  color: white;
  background: rgba(227,6,19,.12);
  border-color: rgba(227,6,19,.5);
  box-shadow: 0 0 24px rgba(227,6,19,.1);
}
.pm-lab-detail {
  min-height: 220px;
  margin-top: 1.6rem;
  padding-top: 1.4rem;
  border-top: 1px solid rgba(255,255,255,.08);
}
.pm-lab-eyebrow {
  margin: 0 0 .55rem;
  color: #b6b6c1 !important;
  font-size: .74rem !important;
  letter-spacing: .08em;
  text-transform: uppercase;
}
.pm-lab-detail h3 {
  margin: 0;
  max-width: 570px;
  color: #f5f5f7;
  font-size: clamp(1.35rem, 2.1vw, 1.8rem);
  line-height: 1.1;
}
.pm-lab-detail > p:not(.pm-lab-eyebrow) {
  margin: .8rem 0 0;
  max-width: 550px;
  color: #7f7f8b;
  line-height: 1.55;
  font-size: .94rem;
}
.pm-lab-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: .75rem 1rem;
  margin-top: 1.25rem;
}
.pm-lab-primary,
.pm-lab-secondary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: .5rem;
  min-height: 45px;
  border-radius: 999px;
  text-decoration: none;
  font-size: .82rem;
  font-weight: 700;
}
.pm-lab-primary {
  padding: .74rem 1rem;
  background: #E30613;
  color: white;
  box-shadow: 0 8px 30px rgba(227,6,19,.18);
}
.pm-lab-primary:hover { transform: translateY(-2px); }
.pm-lab-secondary { color: #92929e; }
.pm-lab-secondary:hover { color: white; }

.pm-lab-stage {
  --pm-lab-accent: #E30613;
  --pm-lab-tilt-x: 0deg;
  --pm-lab-tilt-y: 0deg;
  position: relative;
  min-height: 560px;
  overflow: hidden;
  isolation: isolate;
  border: 1px solid rgba(255,255,255,.09);
  border-radius: clamp(1.5rem, 3vw, 2.4rem);
  background:
    linear-gradient(180deg, rgba(255,255,255,.035), transparent 22%),
    radial-gradient(circle at 50% 42%, color-mix(in srgb, var(--pm-lab-accent) 17%, transparent), transparent 34%),
    #0c0c0e;
  box-shadow:
    0 35px 90px rgba(0,0,0,.42),
    inset 0 1px 0 rgba(255,255,255,.05);
  perspective: 1150px;
  touch-action: pan-y;
}
.pm-lab-stage::after {
  content: "";
  position: absolute;
  inset: auto 8% 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, color-mix(in srgb, var(--pm-lab-accent) 65%, white), transparent);
  opacity: .52;
  box-shadow: 0 0 34px var(--pm-lab-accent);
}
.pm-lab-grid {
  position: absolute;
  inset: 46% -22% -38%;
  transform: rotateX(68deg) translateZ(-80px);
  transform-origin: center top;
  background-image:
    linear-gradient(rgba(255,255,255,.06) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,.06) 1px, transparent 1px);
  background-size: 42px 42px;
  mask-image: linear-gradient(to bottom, black, transparent 75%);
  opacity: .42;
}
.pm-lab-glow {
  position: absolute;
  left: 50%;
  top: 47%;
  width: min(70%, 370px);
  aspect-ratio: 1;
  border-radius: 50%;
  transform: translate(-50%, -50%);
  background: radial-gradient(circle, color-mix(in srgb, var(--pm-lab-accent) 22%, transparent), transparent 68%);
  filter: blur(18px);
  opacity: .95;
  animation: pm-lab-glow 4s ease-in-out infinite;
}
.pm-lab-orbit {
  position: absolute;
  left: 50%;
  top: 47%;
  border: 1px solid color-mix(in srgb, var(--pm-lab-accent) 34%, transparent);
  border-radius: 50%;
  transform-style: preserve-3d;
  pointer-events: none;
}
.pm-lab-orbit-one {
  width: 62%;
  aspect-ratio: 1;
  transform: translate(-50%, -50%) rotateX(70deg) rotateZ(8deg);
  animation: pm-lab-orbit-a 12s linear infinite;
}
.pm-lab-orbit-two {
  width: 45%;
  aspect-ratio: 1;
  transform: translate(-50%, -50%) rotateY(72deg) rotateZ(32deg);
  opacity: .45;
  animation: pm-lab-orbit-b 9s linear infinite reverse;
}
.pm-lab-object-wrap {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  transform-style: preserve-3d;
  transform: rotateX(var(--pm-lab-tilt-x)) rotateY(var(--pm-lab-tilt-y));
  transition: transform .16s ease-out;
}
.pm-lab-object {
  position: relative;
  width: 215px;
  height: 260px;
  transform-style: preserve-3d;
  animation: pm-lab-float 5.2s ease-in-out infinite;
}
.pm-lab-object.is-switching .pm-lab-object-core {
  animation: pm-lab-switch .58s cubic-bezier(.2,.8,.2,1);
}
.pm-lab-object-core {
  position: absolute;
  left: 50%;
  top: 46%;
  width: 165px;
  height: 205px;
  transform: translate(-50%, -50%) rotateX(-7deg) rotateY(-24deg);
  transform-style: preserve-3d;
  border-radius: 28px;
  transition: width .45s ease, height .45s ease, border-radius .45s ease, transform .45s ease;
}
.pm-lab-object-face,
.pm-lab-object-screen {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  backface-visibility: hidden;
}
.pm-lab-object-face-front {
  background:
    linear-gradient(145deg, rgba(255,255,255,.16), transparent 23%),
    linear-gradient(150deg, color-mix(in srgb, var(--pm-lab-accent) 45%, #26262d), #111115 54%, #08080a);
  border: 1px solid rgba(255,255,255,.18);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.18),
    inset -16px -18px 40px rgba(0,0,0,.36),
    24px 28px 65px rgba(0,0,0,.44);
  transform: translateZ(18px);
}
.pm-lab-object-face-back {
  background: #08080a;
  border: 1px solid rgba(255,255,255,.06);
  transform: translateZ(-18px) rotateY(180deg);
}
.pm-lab-object-face-side {
  inset: 8px -18px 8px auto;
  width: 36px;
  border-radius: 8px;
  background: linear-gradient(90deg, #09090b, color-mix(in srgb, var(--pm-lab-accent) 35%, #141419));
  transform-origin: left center;
  transform: rotateY(90deg);
}
.pm-lab-object-screen {
  inset: 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: .65rem;
  border: 1px solid rgba(255,255,255,.1);
  background:
    radial-gradient(circle at 50% 42%, color-mix(in srgb, var(--pm-lab-accent) 22%, transparent), transparent 42%),
    linear-gradient(180deg, rgba(255,255,255,.025), rgba(0,0,0,.18));
  transform: translateZ(19px);
}
.pm-lab-object-mark {
  display: grid;
  place-items: center;
  width: 68px;
  height: 68px;
  border: 1px solid color-mix(in srgb, var(--pm-lab-accent) 52%, transparent);
  border-radius: 22px;
  background: color-mix(in srgb, var(--pm-lab-accent) 12%, transparent);
  color: #fff;
  font-size: 1.55rem;
  font-weight: 800;
  letter-spacing: -.08em;
  box-shadow: 0 0 40px color-mix(in srgb, var(--pm-lab-accent) 22%, transparent);
}
.pm-lab-object-screen small {
  color: rgba(255,255,255,.62);
  font-size: .64rem;
  font-weight: 700;
  letter-spacing: .18em;
  text-transform: uppercase;
}
.pm-lab-object-shadow {
  position: absolute;
  left: 50%;
  bottom: 4px;
  width: 145px;
  height: 30px;
  transform: translateX(-50%) rotateX(74deg);
  border-radius: 50%;
  background: color-mix(in srgb, var(--pm-lab-accent) 35%, #000);
  filter: blur(15px);
  opacity: .55;
}
.pm-lab-object--design .pm-lab-object-core {
  width: 188px;
  height: 188px;
  border-radius: 48px 22px 48px 22px;
  transform: translate(-50%, -50%) rotateX(-8deg) rotateY(-28deg) rotateZ(7deg);
}
.pm-lab-object--studio .pm-lab-object-core {
  width: 196px;
  height: 146px;
  border-radius: 24px;
  transform: translate(-50%, -50%) rotateX(-5deg) rotateY(-20deg);
}
.pm-lab-object--studio .pm-lab-object-screen { inset: 14px 34px 14px 14px; }
.pm-lab-object--studio .pm-lab-object-face-side {
  width: 44px;
}
.pm-lab-object--ai .pm-lab-object-core {
  width: 172px;
  height: 172px;
  border-radius: 50%;
  transform: translate(-50%, -50%) rotateX(-10deg) rotateY(-24deg);
}
.pm-lab-object--ai .pm-lab-object-face,
.pm-lab-object--ai .pm-lab-object-screen { border-radius: 50%; }
.pm-lab-object--ai .pm-lab-object-face-side { display: none; }

.pm-lab-particles {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
.pm-lab-particles i {
  position: absolute;
  display: block;
  border-radius: 50%;
  background: var(--pm-lab-accent);
  opacity: .08;
  box-shadow: 0 0 12px var(--pm-lab-accent);
}
.pm-lab-particles.is-bursting i {
  animation: pm-lab-particle .58s ease-out both;
}
.pm-lab-hud {
  position: absolute;
  left: 1.2rem;
  right: 1.2rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: rgba(255,255,255,.34);
  font-size: .58rem;
  font-weight: 700;
  letter-spacing: .14em;
  pointer-events: none;
}
.pm-lab-hud-top { top: 1.15rem; }
.pm-lab-hud-bottom { bottom: 1.1rem; }

@keyframes pm-lab-float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-13px); }
}
@keyframes pm-lab-glow {
  0%, 100% { transform: translate(-50%, -50%) scale(.9); opacity: .7; }
  50% { transform: translate(-50%, -50%) scale(1.08); opacity: 1; }
}
@keyframes pm-lab-orbit-a {
  to { transform: translate(-50%, -50%) rotateX(70deg) rotateZ(368deg); }
}
@keyframes pm-lab-orbit-b {
  to { transform: translate(-50%, -50%) rotateY(72deg) rotateZ(392deg); }
}
@keyframes pm-lab-switch {
  0% { opacity: 1; filter: blur(0); }
  42% { opacity: .18; filter: blur(10px); transform: translate(-50%, -50%) rotateX(25deg) rotateY(95deg) scale(.65); }
  100% { opacity: 1; filter: blur(0); }
}
@keyframes pm-lab-particle {
  0% { opacity: .15; transform: translate(0, 0) scale(.4); }
  45% { opacity: .95; transform: translate(calc((50% - var(--x, 0px)) * .2), -18px) scale(1.5); }
  100% { opacity: 0; transform: translate(0, -42px) scale(.2); }
}

@media (max-width: 900px) {
  .pm-lab-wrap { grid-template-columns: 1fr; gap: 1.3rem; }
  .pm-lab-stage { min-height: 500px; order: -1; }
  .pm-lab-copy { text-align: center; }
  .pm-lab-copy > h2,
  .pm-lab-intro,
  .pm-lab-detail h3,
  .pm-lab-detail > p { margin-left: auto; margin-right: auto; }
  .pm-lab-tabs,
  .pm-lab-actions { justify-content: center; }
}
@media (max-width: 600px) {
  .pm-lab-shell { padding: 1.5rem .9rem 3rem; }
  .pm-lab-stage { min-height: 420px; border-radius: 1.4rem; }
  .pm-lab-object { transform: scale(.82); }
  .pm-lab-tabs { display: grid; grid-template-columns: repeat(4, 1fr); width: 100%; gap: .35rem; }
  .pm-lab-tabs button { min-width: 0; padding: .6rem .3rem; }
  .pm-lab-detail { min-height: 255px; }
  .pm-lab-hud { left: .8rem; right: .8rem; }
  .pm-lab-hud span:first-child { max-width: 58%; overflow: hidden; white-space: nowrap; }
}
@media (prefers-reduced-motion: reduce) {
  .pm-lab-glow,
  .pm-lab-orbit,
  .pm-lab-object,
  .pm-lab-particles i,
  .pm-lab-object.is-switching .pm-lab-object-core {
    animation: none !important;
  }
  .pm-lab-object-wrap { transition: none; }
}
`

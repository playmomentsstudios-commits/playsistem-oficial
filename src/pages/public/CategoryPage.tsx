import { useLocation } from 'react-router-dom'
import { PublicLayout } from '../../layouts/PublicLayout'
import { ServicesPage } from './ServicesPage'

const CATEGORIES: Record<string, { title:string; subtitle:string; icon:string; color:string; serviceCategory:string }> = {
  studio: { title:'Studio & Criação', subtitle:'Produção audiovisual, fotografia, edição, áudio e criação para transformar ideias em conteúdo.', icon:'🎬', color:'#ff6b35', serviceCategory:'Studio & Criação' },
  design: { title:'Design & Digital', subtitle:'Identidade visual, UI/UX, sites e presença digital pensados para comunicar e converter.', icon:'✦', color:'#4cc9f0', serviceCategory:'Design & Digital' },
  tech: { title:'Tech & Equipamentos', subtitle:'Tecnologia, equipamentos e suporte para colocar projetos em funcionamento com segurança.', icon:'⚡', color:'#06d6a0', serviceCategory:'Tech & Equipamentos' },
}

export function CategoryPage(){
  const location=useLocation()
  const key=location.pathname.split('/').filter(Boolean)[0]||''
  const cat=CATEGORIES[key]

  if(!cat)return <ServicesPage />

  return <PublicLayout>
    <main>
      <section className="px-5 py-12 sm:py-16 text-center">
        <span aria-hidden="true" className="text-4xl block mb-4">{cat.icon}</span>
        <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{color:cat.color}}>Área Play Moments</p>
        <h1 className="text-3xl sm:text-5xl font-bold mb-4" style={{color:'#f0f0f2'}}>{cat.title}</h1>
        <p className="text-base sm:text-lg max-w-2xl mx-auto" style={{color:'#9090a0'}}>{cat.subtitle}</p>
      </section>
      <ServicesPage embedded initialCategory={cat.serviceCategory} title={'Soluções em '+cat.title} subtitle="Veja as opções disponíveis ou envie um projeto personalizado se precisar de algo sob medida." />
    </main>
  </PublicLayout>
}

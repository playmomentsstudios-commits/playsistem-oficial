import { Link } from 'react-router-dom'
import { PublicLayout } from '../../layouts/PublicLayout'
import { useSeo } from '../../lib/seo'

export function NotFoundPage(){
  useSeo({title:'Página não encontrada',description:'A página solicitada não foi encontrada na Sagamente.',canonicalPath:window.location.pathname,noindex:true})
  return <PublicLayout>
    <main className="min-h-[60vh] px-5 py-16 flex items-center justify-center">
      <div className="max-w-xl text-center">
        <p className="text-xs font-bold uppercase tracking-[.2em] text-[#A65A2A]">Erro 404</p>
        <h1 className="mt-3 text-4xl sm:text-5xl font-extrabold">Esta página não foi encontrada.</h1>
        <p className="mt-4 text-gray-400 leading-7">O endereço pode ter mudado ou não existir. Volte ao início ou escolha uma das áreas principais da Sagamente.</p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Link to="/" className="min-h-11 inline-flex items-center rounded-xl bg-[#A65A2A] px-5 font-semibold text-white">Ir para o início</Link>
          <Link to="/servicos" className="min-h-11 inline-flex items-center rounded-xl border border-white/15 px-5 font-semibold text-gray-200">Ver serviços</Link>
          <Link to="/academia" className="min-h-11 inline-flex items-center rounded-xl border border-white/15 px-5 font-semibold text-gray-200">Conhecer a Academia</Link>
        </div>
      </div>
    </main>
  </PublicLayout>
}

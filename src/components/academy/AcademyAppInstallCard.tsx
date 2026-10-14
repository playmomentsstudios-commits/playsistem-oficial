const ACADEMIA_APP_URL = 'https://academia-sagamente.playmomentsstudios.workers.dev/'

export function AcademyAppInstallCard({ admin = false }: { admin?: boolean }) {
 return <section
  aria-labelledby={admin ? 'academy-install-admin-title' : 'academy-install-customer-title'}
  className="mb-5 min-w-0 overflow-hidden rounded-2xl border border-[#DFA269]/25 bg-gradient-to-r from-[#292018] via-[#1B1A1B] to-[#17181C] p-4 sm:p-5"
 >
  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
   <div className="flex min-w-0 items-start gap-3">
    <span aria-hidden="true" className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-[#DFA269]/30 bg-[#A65A2A]/20 text-xl text-[#E8AF7B]">▣</span>
    <div className="min-w-0">
     <p className="text-[10px] font-bold uppercase tracking-[.15em] text-[#E8AF7B]">Aplicativo independente</p>
     <h2 id={admin ? 'academy-install-admin-title' : 'academy-install-customer-title'} className="mt-1 text-base font-bold leading-snug text-white">Instale a Academia Sagamente</h2>
     <p className="mt-1 max-w-xl text-xs leading-relaxed text-gray-300">Leve seus e-books, audiobooks com transcrição e cursos para um aplicativo com menos menus. Use a mesma conta da Sagamente.</p>
    </div>
   </div>
   <a href={ACADEMIA_APP_URL} target="_blank" rel="noopener noreferrer"
    className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-[#A65A2A] px-5 text-center text-xs font-bold text-white hover:bg-[#B96D3A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E8AF7B]">
    Abrir aplicativo para instalar ↗
   </a>
  </div>
  {admin&&<a href="/admin/configuracoes#academia-app" className="mb-2 inline-flex min-h-10 items-center text-xs font-semibold text-[#E8AF7B] hover:underline">Configurar aplicativo na administração →</a>}
  <details className="mt-3 border-t border-white/10 pt-3">
   <summary className="cursor-pointer text-xs font-semibold text-[#E8AF7B]">Como instalar no celular</summary>
   <div className="mt-3 grid gap-2 text-xs leading-relaxed text-gray-300 sm:grid-cols-2">
    <p><strong className="text-white">iPhone / Safari:</strong> abra o aplicativo no Safari, toque em Compartilhar e escolha Adicionar à Tela de Início.</p>
    <p><strong className="text-white">Android / Chrome:</strong> abra o aplicativo no Chrome e escolha Instalar aplicativo ou Adicionar à tela inicial no menu.</p>
   </div>
   <p className="mt-2 text-[11px] text-gray-400">O aplicativo principal permanece disponível. A Academia usa os mesmos conteúdos, mas tem acesso e instalação próprios.</p>
  </details>
 </section>
}

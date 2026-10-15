const ACADEMIA_APP_URL = 'https://academia-sagamente.playmomentsstudios.workers.dev/'

export function AcademyAppInstallCard({ admin = false }: { admin?: boolean }) {
 if (admin) {
  return <aside aria-label="Aplicativo da Academia" className="mb-3 min-w-0 rounded-xl border border-[#DFA269]/20 bg-[#A65A2A]/[.07] px-3 py-2">
   <div className="flex min-w-0 items-center gap-2">
    <span aria-hidden="true" className="hidden h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#A65A2A]/20 text-sm text-[#E8AF7B] sm:grid">▣</span>
    <p className="min-w-0 flex-1 truncate text-xs text-gray-300">
     <strong className="font-semibold text-[#E8AF7B]">App da Academia</strong>
     <span className="hidden sm:inline"> · E-books, audiobooks e cursos no celular</span>
    </p>
    <a href={ACADEMIA_APP_URL} target="_blank" rel="noopener noreferrer"
     className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-lg border border-[#DFA269]/30 px-3 text-xs font-semibold text-[#E8AF7B] hover:bg-[#A65A2A]/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E8AF7B]">
     Abrir/instalar ↗
    </a>
    <details className="relative shrink-0">
     <summary aria-label="Mais opções do aplicativo" className="flex min-h-10 cursor-pointer list-none items-center rounded-lg px-2 text-lg font-bold text-[#E8AF7B] hover:bg-white/[.05] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#E8AF7B]">⋯</summary>
     <div className="absolute right-0 top-full z-30 mt-2 w-72 max-w-[85vw] rounded-xl border border-[#DFA269]/25 bg-[#1B1A1B] p-3 text-xs text-gray-300 shadow-xl">
      <a href="/admin/configuracoes#academia-app" className="inline-flex min-h-10 items-center font-semibold text-[#E8AF7B] hover:underline">Configurar aplicativo →</a>
      <div className="mt-2 space-y-2 border-t border-white/10 pt-3 leading-relaxed">
       <p><strong className="text-white">iPhone / Safari:</strong> abra o aplicativo, toque em Compartilhar e escolha Adicionar à Tela de Início.</p>
       <p><strong className="text-white">Android / Chrome:</strong> abra o aplicativo e escolha Instalar aplicativo ou Adicionar à tela inicial no menu.</p>
      </div>
     </div>
    </details>
   </div>
  </aside>
 }
 return <section
  aria-labelledby="academy-install-customer-title"
  className="mb-5 min-w-0 overflow-hidden rounded-2xl border border-[#DFA269]/25 bg-gradient-to-r from-[#292018] via-[#1B1A1B] to-[#17181C] p-4 sm:p-5"
 >
  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
   <div className="flex min-w-0 items-start gap-3">
    <span aria-hidden="true" className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-[#DFA269]/30 bg-[#A65A2A]/20 text-xl text-[#E8AF7B]">▣</span>
    <div className="min-w-0">
     <p className="text-[10px] font-bold uppercase tracking-[.15em] text-[#E8AF7B]">Aplicativo independente</p>
     <h2 id="academy-install-customer-title" className="mt-1 text-base font-bold leading-snug text-white">Instale a Academia Sagamente</h2>
     <p className="mt-1 max-w-xl text-xs leading-relaxed text-gray-300">Leve seus e-books, audiobooks com transcrição e cursos para um aplicativo com menos menus. Use a mesma conta da Sagamente.</p>
    </div>
   </div>
   <a href={ACADEMIA_APP_URL} target="_blank" rel="noopener noreferrer"
    className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-[#A65A2A] px-5 text-center text-xs font-bold text-white hover:bg-[#B96D3A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E8AF7B]">
    Abrir aplicativo para instalar ↗
   </a>
  </div>
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

import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { DEFAULT_ACADEMY_APP_SETTINGS,readAcademyAppSettings,saveAcademyAppSettings,type AcademyAppSettings } from '../../api/academyAppSettings'

const ACADEMY_URL='https://academia-sagamente.playmomentsstudios.workers.dev/'

export function AcademyAppSettingsPanel() {
 const [value,setValue]=useState<AcademyAppSettings>(DEFAULT_ACADEMY_APP_SETTINGS)
 const [loading,setLoading]=useState(true)
 const [saving,setSaving]=useState(false)
 const [status,setStatus]=useState('')
 const [error,setError]=useState('')

 useEffect(()=>{
  let active=true
  void readAcademyAppSettings()
   .then(row=>{if(active)setValue(row)})
   .catch(e=>{if(active)setError(e instanceof Error?e.message:'Falha ao carregar configurações da Academia.')})
   .finally(()=>{if(active)setLoading(false)})
  return()=>{active=false}
 },[])

 async function save(event:FormEvent<HTMLFormElement>){
  event.preventDefault()
  if(saving)return
  setSaving(true);setError('');setStatus('')
  try {
   const next=await saveAcademyAppSettings(value)
   setValue(next)
   setStatus('Configurações da Academia salvas. A tela inicial será atualizada no próximo acesso, sem novo deploy.')
  } catch(e) {setError(e instanceof Error?e.message:'Não foi possível salvar as configurações.')}
  finally {setSaving(false)}
 }
 const field='mt-1 w-full min-h-11 rounded-xl border border-white/10 bg-black px-3 text-sm text-white outline-none focus:border-[#DFA269]'
 return <section id="academia-app" aria-labelledby="academy-app-settings-title" className="rounded-2xl border border-white/10 bg-[#141416] p-5 lg:col-span-2">
  <div className="flex flex-wrap items-start justify-between gap-3">
   <div><p className="text-[10px] font-semibold uppercase tracking-[.16em] text-[#DFA269]">Aplicativos</p>
    <h2 id="academy-app-settings-title" className="mt-1 text-lg font-semibold">Academia Sagamente (PWA)</h2>
    <p className="mt-1 text-xs leading-relaxed text-gray-400">Identidade própria e textos da tela inicial. Não altera o aplicativo Sagamente principal, as aulas nem as permissões.</p>
   </div>
   <a href={ACADEMY_URL} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center rounded-lg border border-[#DFA269]/30 px-3 text-xs font-semibold text-[#DFA269] hover:bg-white/[.04]">Abrir aplicativo ↗</a>
  </div>
  <div className="mt-5 flex flex-wrap items-center gap-4 rounded-xl border border-white/[.06] bg-black/25 p-3">
   <div className="flex items-center gap-3">
    <div className="text-center"><img src="/pwa/icon-192.png" alt="Ícone original da Sagamente" width={56} height={56} className="h-14 w-14 rounded-xl"/><p className="mt-1 text-[10px] text-gray-400">Sagamente</p></div>
    <span aria-hidden="true" className="pb-4 text-xs text-gray-500">→</span>
    <div className="text-center"><img src="/pwa/academy-icon-192.png" alt="Novo ícone da Academia Sagamente, com cores invertidas" width={56} height={56} className="h-14 w-14 rounded-xl"/><p className="mt-1 text-[10px] text-[#DFA269]">Academia</p></div>
   </div>
   <p className="min-w-0 max-w-md text-xs leading-relaxed text-gray-400">Mesmo símbolo geométrico: segmentos brancos passam para laranja; segmentos laranjas passam para grafite sobre fundo claro. Cada aplicativo terá seu próprio ícone na tela inicial.</p>
  </div>
  {loading?<p role="status" className="mt-5 text-xs text-gray-400">Carregando configurações da Academia…</p>:
  <form className="mt-5 space-y-4" onSubmit={event=>void save(event)}>
   <div className="grid gap-4 sm:grid-cols-2">
    <label className="block text-xs text-gray-400">Etiqueta superior da Home
     <input required maxLength={48} className={field} value={value.hero_eyebrow} onChange={e=>setValue(v=>({...v,hero_eyebrow:e.target.value}))}/>
    </label>
    <label className="block text-xs text-gray-400">Título de destaque
     <input required maxLength={110} className={field} value={value.hero_title} onChange={e=>setValue(v=>({...v,hero_title:e.target.value}))}/>
    </label>
   </div>
   <label className="block text-xs text-gray-400">Descrição do destaque
    <textarea rows={2} required maxLength={200} className={field+' py-3'} value={value.hero_subtitle} onChange={e=>setValue(v=>({...v,hero_subtitle:e.target.value}))}/>
   </label>
   <div className="grid gap-3 sm:grid-cols-2">
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-white/[.07] p-3 text-xs text-gray-300">
     <span>Exibir atalhos Áudio / E-book / Cursos</span>
     <input type="checkbox" checked={value.show_quick_links} onChange={e=>setValue(v=>({...v,show_quick_links:e.target.checked}))} className="h-4 w-4 accent-[#DFA269]"/>
    </label>
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-white/[.07] p-3 text-xs text-gray-300">
     <span>Exibir Meus cursos na Home</span>
     <input type="checkbox" checked={value.show_courses} onChange={e=>setValue(v=>({...v,show_courses:e.target.checked}))} className="h-4 w-4 accent-[#DFA269]"/>
    </label>
   </div>
   <div className="flex flex-wrap items-center justify-between gap-3">
    <p className="text-[11px] text-gray-500">O ícone instalável é gerado no build. Textos e seções são ajustáveis aqui sem atualizar o código.</p>
    <button type="submit" disabled={saving} className="min-h-11 rounded-xl bg-[#A65A2A] px-5 text-sm font-semibold text-white disabled:opacity-50">{saving?'Salvando…':'Salvar Academia'}</button>
   </div>
  </form>}
  {status&&<p role="status" className="mt-3 text-xs text-emerald-300">{status}</p>}
  {error&&<p role="alert" className="mt-3 text-xs text-red-300">{error}</p>}
  <div className="mt-4 border-t border-white/[.06] pt-3 text-[11px] text-gray-500">
   <Link to="/admin/academia" className="text-[#DFA269] hover:underline">Administrar cursos e biblioteca →</Link>
  </div>
 </section>
}

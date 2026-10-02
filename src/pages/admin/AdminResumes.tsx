import { useEffect, useState } from 'react'
import { Button } from '../../components/ui/Button'
import { useToast } from '../../contexts/ToastContext'
import { siteContentApi, type Resume } from '../../services/siteContent'

function emptyResume(): Partial<Resume> {
  return {
    resume_type: 'mini',
    status: 'draft',
    internal_title: '',
    slug: '',
    eyebrow: '',
    display_name: '',
    headline: '',
    summary: '',
    identity_text: '',
    callout: '',
    location: '',
    market_since: null,
    photo_url: '',
    photo_drive_file_id: null,
    contact_email: '',
    contact_phone: '',
    instagram: '',
    linkedin_url: '',
    website_url: '',
    whatsapp: '',
    skills: [],
    experience: [],
    portfolio: [],
    extra_sections: [],
    seo_title: '',
    seo_description: '',
  }
}

const fieldClass = 'w-full min-h-11 px-3 rounded-xl bg-black border border-white/10 outline-none focus:border-[#E30613]/60'
const textareaClass = 'w-full p-3 rounded-xl bg-black border border-white/10 outline-none focus:border-[#E30613]/60'

export function AdminResumes() {
  const toast = useToast()
  const [rows, setRows] = useState<Resume[]>([])
  const [form, setForm] = useState<Partial<Resume>>(emptyResume())
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  async function load(selectId?: string) {
    try {
      setLoading(true)
      const data = await siteContentApi.resumes(true)
      setRows(data)
      if (selectId) {
        const selected = data.find(item => item.id === selectId)
        if (selected) setForm(selected)
      }
    } catch (error: any) {
      toast(error.message || 'Não foi possível carregar os currículos.', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  function set<K extends keyof Resume>(key: K, value: Resume[K] | null) {
    setForm(current => ({ ...current, [key]: value }))
  }

  async function save() {
    try {
      setSaving(true)
      const saved = await siteContentApi.saveResume(form)
      await load(saved.id)
      toast(form.id ? 'Currículo atualizado.' : 'Currículo criado.', 'success')
    } catch (error: any) {
      toast(error.message || 'Não foi possível salvar o currículo.', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function uploadPhoto(file?: File) {
    if (!file) return
    try {
      setSaving(true)
      const asset = await siteContentApi.uploadSiteAsset(file, 'PROFILE')
      setForm(current => ({ ...current, photo_url: asset.url, photo_drive_file_id: asset.driveFileId }))
      toast('Foto enviada para o Google Drive. Salve o currículo para concluir.', 'success')
    } catch (error: any) {
      toast(error.message || 'Não foi possível enviar a foto.', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function duplicate(row: Resume) {
    try {
      setSaving(true)
      const copy = await siteContentApi.duplicateResume(row.id)
      await load(copy.id)
      toast('Cópia criada como rascunho.', 'success')
    } catch (error: any) {
      toast(error.message || 'Não foi possível duplicar.', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function remove(row: Resume) {
    if (!window.confirm('Excluir este currículo? Essa ação não pode ser desfeita.')) return
    try {
      await siteContentApi.deleteResume(row.id)
      if (form.id === row.id) setForm(emptyResume())
      await load()
      toast('Currículo excluído.', 'success')
    } catch (error: any) {
      toast(error.message || 'Não foi possível excluir.', 'error')
    }
  }

  async function copyPublicLink(row: Resume) {
    const link = window.location.origin + '/curriculos/' + row.slug
    try {
      await navigator.clipboard.writeText(link)
      toast('Link público copiado.', 'success')
    } catch {
      window.prompt('Copie o link do currículo:', link)
    }
  }

  const currentLabel = form.internal_title || form.display_name || (form.id ? 'Currículo sem título' : 'Novo currículo')

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[.22em] text-[#ff6674] font-bold">Identidade profissional</p>
          <h1 className="text-2xl md:text-3xl font-bold mt-1">Currículos</h1>
          <p className="text-sm text-gray-500 mt-1 max-w-3xl">Crie versões diferentes para seleções, vagas, editais e apresentações. Nenhum campo de conteúdo é obrigatório: a página publica apenas o que estiver preenchido.</p>
        </div>
        <Button variant="secondary" onClick={() => setForm(emptyResume())}>+ Adicionar currículo</Button>
      </div>

      <div className="grid 2xl:grid-cols-[minmax(0,1.2fr)_420px] gap-6 items-start">
        <section className="pm-surface p-4 md:p-6 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center gap-3 md:justify-between">
            <div>
              <p className="text-xs text-gray-500">Editando</p>
              <h2 className="font-bold text-lg">{currentLabel}</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {form.id && form.status === 'published' && form.slug && (
                <a href={'/curriculos/' + form.slug} target="_blank" rel="noreferrer" className="min-h-10 px-3 rounded-xl bg-white/[.06] border border-white/10 text-xs font-semibold inline-flex items-center">Abrir página ↗</a>
              )}
              {form.id && <Button variant="secondary" onClick={() => void duplicate(form as Resume)}>Duplicar</Button>}
              <Button onClick={() => void save()} loading={saving}>Salvar</Button>
            </div>
          </div>

          <div className="rounded-2xl border border-[#E30613]/20 bg-[#E30613]/5 p-4">
            <p className="text-sm font-semibold text-[#ff7a86]">Estrutura flexível</p>
            <p className="text-xs text-gray-400 mt-1">Você pode salvar só nome + apresentação + contato para um minicurrículo. Depois, a mesma estrutura pode receber experiência, portfólio e outras seções sem precisar recriar a página.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-3">
            <label className="text-xs text-gray-500 md:col-span-2">Título interno
              <input className={fieldClass + ' mt-1'} value={form.internal_title || ''} onChange={e => set('internal_title', e.target.value)} placeholder="Ex.: Minicurrículo — Fundo Quilombola" />
            </label>
            <label className="text-xs text-gray-500">Tipo
              <select className={fieldClass + ' mt-1'} value={form.resume_type || 'mini'} onChange={e => set('resume_type', e.target.value as Resume['resume_type'])}>
                <option value="mini">Minicurrículo</option>
                <option value="complete">Currículo completo</option>
                <option value="portfolio">Currículo + portfólio</option>
                <option value="custom">Personalizado</option>
              </select>
            </label>
            <label className="text-xs text-gray-500 md:col-span-2">Slug / endereço
              <div className="mt-1 flex rounded-xl overflow-hidden border border-white/10 bg-black">
                <span className="hidden sm:flex items-center px-3 text-[11px] text-gray-600 border-r border-white/10">/curriculos/</span>
                <input className="flex-1 min-w-0 min-h-11 px-3 bg-transparent outline-none" value={form.slug || ''} onChange={e => set('slug', e.target.value)} placeholder="gerado automaticamente se ficar vazio" />
              </div>
            </label>
            <label className="text-xs text-gray-500">Status
              <select className={fieldClass + ' mt-1'} value={form.status || 'draft'} onChange={e => set('status', e.target.value as Resume['status'])}>
                <option value="draft">Rascunho</option>
                <option value="published">Publicado</option>
                <option value="archived">Arquivado</option>
              </select>
            </label>
          </div>

          <div className="grid lg:grid-cols-[220px_1fr] gap-5">
            <div className="rounded-2xl border border-white/10 bg-black/30 p-3">
              <div className="aspect-[4/5] rounded-xl overflow-hidden bg-white/[.03] flex items-center justify-center">
                {form.photo_url ? <img src={form.photo_url} alt="" className="w-full h-full object-cover" /> : <span className="text-4xl text-gray-700">FC</span>}
              </div>
              <label className="mt-3 min-h-11 rounded-xl bg-white/[.06] border border-white/10 flex items-center justify-center text-xs font-semibold cursor-pointer">
                <input type="file" accept="image/*" className="sr-only" onChange={e => void uploadPhoto(e.target.files?.[0])} />
                {form.photo_url ? 'Trocar foto' : 'Adicionar foto'}
              </label>
              <p className="text-[10px] text-gray-600 mt-2">A imagem é enviada ao Google Drive da Play Moments.</p>
            </div>

            <div className="space-y-3">
              <label className="text-xs text-gray-500 block">Linha superior
                <input className={fieldClass + ' mt-1'} value={form.eyebrow || ''} onChange={e => set('eyebrow', e.target.value)} placeholder="Minicurrículo · Design & Comunicação" />
              </label>
              <label className="text-xs text-gray-500 block">Nome
                <input className={fieldClass + ' mt-1'} value={form.display_name || ''} onChange={e => set('display_name', e.target.value)} placeholder="Felipe Costa Souza" />
              </label>
              <label className="text-xs text-gray-500 block">Título profissional
                <input className={fieldClass + ' mt-1'} value={form.headline || ''} onChange={e => set('headline', e.target.value)} placeholder="Designer e comunicador quilombola Kalunga" />
              </label>
              <label className="text-xs text-gray-500 block">Frase de impacto
                <input className={fieldClass + ' mt-1'} value={form.callout || ''} onChange={e => set('callout', e.target.value)} placeholder="Design também é território, identidade e memória." />
              </label>
            </div>
          </div>

          <div className="grid gap-4">
            <label className="text-xs text-gray-500">Apresentação
              <textarea className={textareaClass + ' mt-1'} rows={5} value={form.summary || ''} onChange={e => set('summary', e.target.value)} placeholder="Um resumo curto e forte sobre sua trajetória." />
            </label>
            <label className="text-xs text-gray-500">Identidade, território e trajetória
              <textarea className={textareaClass + ' mt-1'} rows={5} value={form.identity_text || ''} onChange={e => set('identity_text', e.target.value)} placeholder="Contexto que faça sentido para esta versão do currículo." />
            </label>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <label className="text-xs text-gray-500">Localização
              <input className={fieldClass + ' mt-1'} value={form.location || ''} onChange={e => set('location', e.target.value)} placeholder="Cavalcante, Goiás" />
            </label>
            <label className="text-xs text-gray-500">Atuação desde
              <input type="number" className={fieldClass + ' mt-1'} value={form.market_since ?? ''} onChange={e => set('market_since', e.target.value ? Number(e.target.value) : null)} placeholder="2008" />
            </label>
          </div>

          <label className="text-xs text-gray-500 block">Competências
            <p className="text-[10px] text-gray-600 mt-1">Uma por linha. Deixe vazio se esta versão não precisar.</p>
            <textarea className={textareaClass + ' mt-2'} rows={5} value={(form.skills || []).join('\n')} onChange={e => set('skills', e.target.value.split('\n').map(value => value.trim()).filter(Boolean))} placeholder={'Identidade visual\nDesign gráfico\nDireção de arte'} />
          </label>

          <div>
            <h3 className="font-semibold">Contatos</h3>
            <p className="text-xs text-gray-600 mt-1">Todos opcionais. Só aparecem na página quando preenchidos.</p>
            <div className="grid sm:grid-cols-2 gap-3 mt-3">
              <label className="text-xs text-gray-500">E-mail<input className={fieldClass + ' mt-1'} value={form.contact_email || ''} onChange={e => set('contact_email', e.target.value)} /></label>
              <label className="text-xs text-gray-500">Telefone<input className={fieldClass + ' mt-1'} value={form.contact_phone || ''} onChange={e => set('contact_phone', e.target.value)} /></label>
              <label className="text-xs text-gray-500">Instagram<input className={fieldClass + ' mt-1'} value={form.instagram || ''} onChange={e => set('instagram', e.target.value)} placeholder="@usuario" /></label>
              <label className="text-xs text-gray-500">WhatsApp<input className={fieldClass + ' mt-1'} value={form.whatsapp || ''} onChange={e => set('whatsapp', e.target.value)} placeholder="se diferente do telefone" /></label>
              <label className="text-xs text-gray-500">LinkedIn<input className={fieldClass + ' mt-1'} value={form.linkedin_url || ''} onChange={e => set('linkedin_url', e.target.value)} /></label>
              <label className="text-xs text-gray-500">Site / portfólio<input className={fieldClass + ' mt-1'} value={form.website_url || ''} onChange={e => set('website_url', e.target.value)} /></label>
            </div>
          </div>

          <details className="rounded-2xl border border-white/10 p-4">
            <summary className="cursor-pointer text-sm font-semibold">SEO opcional</summary>
            <div className="grid sm:grid-cols-2 gap-3 mt-4">
              <label className="text-xs text-gray-500">Título SEO<input className={fieldClass + ' mt-1'} value={form.seo_title || ''} onChange={e => set('seo_title', e.target.value)} /></label>
              <label className="text-xs text-gray-500">Descrição SEO<input className={fieldClass + ' mt-1'} value={form.seo_description || ''} onChange={e => set('seo_description', e.target.value)} /></label>
            </div>
          </details>

          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/10">
            <Button onClick={() => void save()} loading={saving}>Salvar currículo</Button>
            {form.id && <Button variant="secondary" onClick={() => setForm(emptyResume())}>Novo</Button>}
          </div>
        </section>

        <aside className="space-y-3 2xl:sticky 2xl:top-6">
          <div className="flex items-center justify-between">
            <div><h2 className="font-bold">Versões criadas</h2><p className="text-xs text-gray-600">{rows.length} currículo(s)</p></div>
          </div>
          {loading && <div className="pm-surface p-5 text-sm text-gray-500">Carregando...</div>}
          {!loading && rows.map(row => (
            <div key={row.id} className={'rounded-2xl border p-4 transition-colors ' + (form.id === row.id ? 'border-[#E30613]/50 bg-[#E30613]/5' : 'border-white/10 bg-[#141416]')}>
              <div className="flex gap-3">
                <div className="w-14 h-14 rounded-xl bg-black/40 overflow-hidden shrink-0 flex items-center justify-center">
                  {row.photo_url ? <img src={row.photo_url} alt="" className="w-full h-full object-cover" /> : <span className="font-bold text-gray-600">{(row.display_name || 'CV').slice(0, 2).toUpperCase()}</span>}
                </div>
                <div className="min-w-0 flex-1">
                  <button className="text-left w-full" onClick={() => setForm(row)}>
                    <p className="font-semibold text-sm truncate">{row.internal_title || row.display_name || 'Currículo sem título'}</p>
                    <p className="text-[11px] text-gray-600 mt-1 truncate">/curriculos/{row.slug}</p>
                  </button>
                  <div className="flex gap-2 mt-2">
                    <span className={'text-[10px] px-2 py-1 rounded-full ' + (row.status === 'published' ? 'bg-emerald-500/10 text-emerald-300' : row.status === 'archived' ? 'bg-white/[.06] text-gray-500' : 'bg-amber-500/10 text-amber-300')}>{row.status === 'published' ? 'Publicado' : row.status === 'archived' ? 'Arquivado' : 'Rascunho'}</span>
                    <span className="text-[10px] px-2 py-1 rounded-full bg-white/[.05] text-gray-500">{row.resume_type}</span>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-white/[.07]">
                <button onClick={() => setForm(row)} className="text-xs text-gray-300">Editar</button>
                <button onClick={() => void duplicate(row)} className="text-xs text-gray-400">Duplicar</button>
                {row.status === 'published' && <button onClick={() => void copyPublicLink(row)} className="text-xs text-[#ff6a78]">Copiar link</button>}
                <button onClick={() => void remove(row)} className="text-xs text-red-400 ml-auto">Excluir</button>
              </div>
            </div>
          ))}
          {!loading && !rows.length && <div className="pm-surface p-5 text-sm text-gray-500">Nenhum currículo criado ainda.</div>}
        </aside>
      </div>
    </div>
  )
}

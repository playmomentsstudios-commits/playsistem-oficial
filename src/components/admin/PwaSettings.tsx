import { useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { supabase } from '../../lib/supabase'
import { siteContentApi } from '../../services/siteContent'

type IconKey = 'icon_180_drive_file_id' | 'icon_192_drive_file_id' |
  'icon_512_drive_file_id' | 'icon_maskable_drive_file_id'
type AppIdentity = {
  name: string
  short_name: string
  description: string
  theme_color: string
  background_color: string
  icon_180_drive_file_id: string | null
  icon_192_drive_file_id: string | null
  icon_512_drive_file_id: string | null
  icon_maskable_drive_file_id: string | null
}
type SavedIdentity = AppIdentity & { updated_at: string }
const ICONS: ReadonlyArray<{ key: IconKey; size: number; maskable: boolean }> = [
  { key: 'icon_180_drive_file_id', size: 180, maskable: false },
  { key: 'icon_192_drive_file_id', size: 192, maskable: false },
  { key: 'icon_512_drive_file_id', size: 512, maskable: false },
  { key: 'icon_maskable_drive_file_id', size: 512, maskable: true }
]
const VALID_COLOR = /^#[\da-fA-F]{6}$/
const DEFAULT: AppIdentity = {
  name: 'Sagamente',
  short_name: 'Sagamente',
  description: 'Projetos, serviços, arquivos, cursos e tecnologia em um só lugar.',
  theme_color: '#0a0a0b',
  background_color: '#0a0a0b',
  icon_180_drive_file_id: null,
  icon_192_drive_file_id: null,
  icon_512_drive_file_id: null,
  icon_maskable_drive_file_id: null
}

function iconUrl(field: IconKey, settings: SavedIdentity | null): string {
  const url = ({
    icon_180_drive_file_id: '/pwa/icon-180.png',
    icon_192_drive_file_id: '/pwa/icon-192.png',
    icon_512_drive_file_id: '/pwa/icon-512.png',
    icon_maskable_drive_file_id: '/pwa/maskable-512.png'
  } as const)[field]
  return url + (settings ? '?v=' + encodeURIComponent(settings.updated_at) : '')
}

async function readImage(file: File): Promise<HTMLImageElement> {
  const objectUrl = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.src = objectUrl
    await image.decode()
    return image
  } finally {
    // decode() keeps the pixels in memory; the source URL is no longer required.
    URL.revokeObjectURL(objectUrl)
  }
}
async function makeIcon(image: HTMLImageElement, size: number, maskable: boolean, background: string): Promise<File> {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Este navegador não conseguiu preparar os ícones.')
  ctx.fillStyle = background
  ctx.fillRect(0, 0, size, size)
  const inset = maskable ? Math.round(size * 0.205) : 0
  ctx.drawImage(image, inset, inset, size - 2 * inset, size - 2 * inset)
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(result => result ? resolve(result) : reject(new Error('Falha ao converter a imagem em PNG.')), 'image/png'))
  return new File([blob], 'sagamente-pwa-' + (maskable ? 'maskable-' : '') + size + '.png', { type: 'image/png' })
}

export function PwaSettings() {
  const { user } = useAuth()
  const toast = useToast()
  const [saved, setSaved] = useState<SavedIdentity | null>(null)
  const [draft, setDraft] = useState<AppIdentity>(DEFAULT)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadStep, setUploadStep] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState<string | null>(null)
  const previewRef = useRef<string | null>(null)
  const canEdit = user?.role === 'admin'

  useEffect(() => {
    let active = true
    void supabase.from('pwa_settings').select('*').eq('id', true).single().then(({ data, error: loadError }) => {
      if (loadError) throw loadError
      if (!data || !active) return
      const row = data as SavedIdentity
      setSaved(row)
      setDraft(Object.fromEntries(Object.keys(DEFAULT).map(key => [key, row[key as keyof AppIdentity]])) as AppIdentity)
    }).catch((cause: unknown) => {
      if (active) setError(cause instanceof Error ? cause.message : 'Não foi possível carregar as configurações do aplicativo.')
    }).finally(() => { if (active) setLoading(false) })
    return () => {
      active = false
      if (previewRef.current) URL.revokeObjectURL(previewRef.current)
    }
  }, [])

  const changed = useMemo(() => !!saved && (Object.keys(DEFAULT) as (keyof AppIdentity)[])
    .some(key => draft[key] !== saved[key]), [draft, saved])

  const set = (key: keyof AppIdentity, value: string | null) =>
    setDraft(prev => ({ ...prev, [key]: value }))

  async function uploadIcons(file: File) {
    if (!canEdit) return
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      toast('Envie uma imagem PNG, JPG ou WebP.', 'error'); return
    }
    if (file.size > 8 * 1024 * 1024) {
      toast('A imagem deve ter até 8 MB.', 'error'); return
    }
    setUploading(true)
    try {
      const image = await readImage(file)
      if (image.naturalWidth !== image.naturalHeight || image.naturalWidth < 512) {
        throw new Error('Envie uma imagem quadrada com pelo menos 512 × 512 pixels.')
      }
      if (!VALID_COLOR.test(draft.background_color)) throw new Error('Cor de fundo inválida.')
      const files = await Promise.all(ICONS.map(item => makeIcon(image, item.size, item.maskable, draft.background_color)))
      const uploaded: Partial<Record<IconKey, string>> = {}
      for (let index = 0; index < ICONS.length; index++) {
        setUploadStep('Enviando versão ' + (index + 1) + ' de ' + ICONS.length + ' ao Google Drive...')
        const asset = await siteContentApi.uploadSiteAsset(files[index], 'BRAND')
        uploaded[ICONS[index].key] = asset.driveFileId
      }
      setDraft(previous => ({ ...previous, ...uploaded }))
      if (previewRef.current) URL.revokeObjectURL(previewRef.current)
      const nextPreview = URL.createObjectURL(files[2])
      previewRef.current = nextPreview
      setPreview(nextPreview)
      toast('Ícones enviados ao Drive. Clique em Publicar aplicativo para ativá-los.', 'success')
    } catch (cause: unknown) {
      toast(cause instanceof Error ? cause.message : 'Falha ao enviar o ícone.', 'error')
    } finally {
      setUploading(false)
      setUploadStep('')
    }
  }

  async function publish() {
    if (!canEdit || !saved) return
    const values = {
      ...draft,
      name: draft.name.trim(),
      short_name: draft.short_name.trim(),
      description: draft.description.trim()
    }
    if (!values.name || values.name.length > 80 || !values.short_name || values.short_name.length > 24 ||
        !values.description || values.description.length > 250 ||
        !VALID_COLOR.test(values.theme_color) || !VALID_COLOR.test(values.background_color)) {
      toast('Revise o nome, a descrição e as cores do aplicativo.', 'error'); return
    }
    setSaving(true)
    try {
      const { data, error: updateError } = await supabase.from('pwa_settings')
        .update({ ...values, updated_at: new Date().toISOString(), updated_by: user?.id || null })
        .eq('id', true).select('*').single()
      if (updateError) throw updateError
      const updated = data as SavedIdentity
      setSaved(updated)
      setDraft(Object.fromEntries(Object.keys(DEFAULT).map(key => [key, updated[key as keyof AppIdentity]])) as AppIdentity)
      toast('Identidade do aplicativo publicada! Instale novamente no iPhone para atualizar ícone e nome.', 'success')
    } catch (cause: unknown) {
      toast(cause instanceof Error ? cause.message : 'Não foi possível publicar o aplicativo.', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p role="status" className="p-6 text-gray-400">Carregando aplicativo...</p>
  if (error || !saved) return <div role="alert" className="rounded-xl border border-red-500/20 p-5 text-red-300">
    Não foi possível abrir o editor PWA. {error || 'Configuração indisponível.'}
  </div>
  const previewSrc = preview || iconUrl('icon_512_drive_file_id', saved)
  return <div className="space-y-5">
    <section className="rounded-2xl border border-white/10 bg-[#141416] p-5">
      <p className="uppercase tracking-widest text-[#DFA269] font-semibold text-[11px]">Personalização do aplicativo</p>
      <h2 className="text-xl font-bold mt-2">Aplicativo (PWA)</h2>
      <p className="mt-2 text-sm text-gray-400 leading-6">
        Configure a apresentação do Sagamente na Tela de Início do iPhone, Android e Windows.
        O aplicativo utiliza o mesmo site, login, projetos e banco de dados.
      </p>
      {!canEdit && <p className="mt-3 text-amber-300 text-xs">Somente o administrador mestre pode modificar estas configurações.</p>}
    </section>

    <div className="grid lg:grid-cols-[minmax(0,1fr)_280px] gap-5">
      <div className="space-y-5">
        <section className="rounded-2xl border border-white/10 bg-[#141416] p-5 space-y-4">
          <h3 className="font-semibold">Nome e identificação</h3>
          <label className="block text-sm text-gray-300">Nome completo
            <input disabled={!canEdit} maxLength={80} value={draft.name} onChange={e => set('name', e.target.value)}
              className="mt-2 w-full min-h-11 rounded-xl px-3 bg-black border border-white/10 text-white" />
          </label>
          <label className="block text-sm text-gray-300">Nome abaixo do ícone
            <input disabled={!canEdit} maxLength={24} value={draft.short_name} onChange={e => set('short_name', e.target.value)}
              className="mt-2 w-full min-h-11 rounded-xl px-3 bg-black border border-white/10 text-white" />
            <span className="block mt-1.5 text-xs text-gray-500">Recomendado: Sagamente. Nomes longos podem ser abreviados pelo iPhone.</span>
          </label>
          <label className="block text-sm text-gray-300">Descrição
            <textarea disabled={!canEdit} maxLength={250} rows={3} value={draft.description}
              onChange={e => set('description', e.target.value)}
              className="mt-2 w-full rounded-xl px-3 py-3 bg-black border border-white/10 text-white resize-y" />
          </label>
        </section>
        <section className="rounded-2xl border border-white/10 bg-[#141416] p-5 space-y-4">
          <h3 className="font-semibold">Ícone do aplicativo</h3>
          <p className="text-xs text-gray-400">Envie um PNG, JPG ou WebP quadrado de pelo menos 512 × 512 pixels, até 8 MB. O sistema gera automaticamente os tamanhos do iPhone, Android e Windows.</p>
          <label className={'inline-flex min-h-11 items-center rounded-xl border border-[#A65A2A]/60 px-4 text-sm font-semibold text-[#DFA269] ' +
            (!canEdit || uploading || saving ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-[#A65A2A]/10')}>
            {uploading ? 'Processando ícones...' : 'Enviar novo ícone'}
            <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" disabled={!canEdit || uploading || saving}
              onChange={e => { const file = e.currentTarget.files?.[0]; if (file) void uploadIcons(file); e.currentTarget.value = '' }} />
          </label>
          {uploadStep && <p role="status" className="text-xs text-[#DFA269]">{uploadStep}</p>}
          <button type="button" disabled={!canEdit || uploading || saving}
            className="block text-xs text-gray-400 underline disabled:opacity-40"
            onClick={() => {
              setDraft(prev => ({ ...prev, ...Object.fromEntries(ICONS.map(icon => [icon.key, null])) }))
              setPreview(null)
              if (previewRef.current) URL.revokeObjectURL(previewRef.current)
              previewRef.current = null
            }}>Restaurar ícone padrão Sagamente</button>
          <p className="text-xs text-gray-500">As imagens permanecem no Google Drive institucional; o Supabase guarda apenas os identificadores.</p>
        </section>
        <section className="rounded-2xl border border-white/10 bg-[#141416] p-5">
          <h3 className="font-semibold mb-4">Cores do aplicativo</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            {(['theme_color', 'background_color'] as const).map(key =>
              <label key={key} className="block text-sm text-gray-300">
                {key === 'theme_color' ? 'Cor do tema' : 'Cor de fundo / abertura'}
                <div className="flex gap-3 mt-2 items-center">
                  <input type="color" disabled={!canEdit} value={draft[key]} onChange={e => set(key, e.target.value)}
                    className="h-11 w-12 rounded-lg cursor-pointer bg-transparent" />
                  <input disabled={!canEdit} aria-label={key} value={draft[key]}
                    onChange={e => set(key, e.target.value)}
                    className="min-w-0 w-32 h-11 rounded-lg border border-white/10 bg-black px-3 text-sm font-mono" />
                </div>
              </label>)}
          </div>
          <p className="text-xs text-gray-500 mt-3">Ao alterar a cor do fundo, envie novamente o ícone para aplicar a nova cor nos arquivos PNG.</p>
        </section>
      </div>
      <aside className="rounded-2xl border border-white/10 bg-[#141416] p-5 h-fit lg:sticky lg:top-6">
        <h3 className="font-semibold mb-4">Prévia · Tela de Início</h3>
        <div className="mx-auto w-full max-w-[215px] rounded-[30px] bg-gradient-to-br from-[#6a89cb] to-[#5b739b] p-7 text-center">
          <div className="mx-auto w-[100px] h-[100px] overflow-hidden rounded-[22px] bg-[#0a0a0b] shadow-lg">
            <img src={previewSrc} alt="Prévia do ícone do aplicativo" className="w-full h-full object-cover" />
          </div>
          <p className="text-white text-sm font-medium truncate mt-2">{draft.short_name || 'Sagamente'}</p>
        </div>
        <p className="mt-4 text-xs text-gray-500 leading-5">Representação aproximada: o recorte e a aparência final são controlados pelo sistema operacional.</p>
      </aside>
    </div>
    <section className="rounded-2xl border border-white/10 bg-[#101112] p-4 flex flex-wrap gap-3 items-center">
      <button type="button" disabled={!changed || uploading || saving || !canEdit} onClick={() => void publish()}
        className="rounded-xl min-h-12 px-6 bg-[#A65A2A] hover:bg-[#81431E] text-white text-sm font-semibold disabled:opacity-40">
        {saving ? 'Publicando...' : 'Publicar aplicativo'}
      </button>
      <button type="button" disabled={!changed || uploading || saving} className="min-h-11 px-4 rounded-xl border border-white/10 text-sm text-gray-300 disabled:opacity-40"
        onClick={() => {
          setDraft(Object.fromEntries(Object.keys(DEFAULT).map(key => [key, saved[key as keyof AppIdentity]])) as AppIdentity)
          if (previewRef.current) URL.revokeObjectURL(previewRef.current)
          previewRef.current = null
          setPreview(null)
        }}>Descartar alterações</button>
      <a href="/instalar" target="_blank" rel="noopener noreferrer" className="text-sm text-[#DFA269] underline">Abrir página de instalação ↗</a>
    </section>
    <p className="text-xs text-gray-500 leading-6">
      Importante: o iPhone pode manter o ícone e o nome do atalho antigo em cache. Após publicar, remova
      o aplicativo da Tela de Início e adicione-o novamente pelo Safari. Os dados da sua conta permanecem no servidor.
    </p>
  </div>
}

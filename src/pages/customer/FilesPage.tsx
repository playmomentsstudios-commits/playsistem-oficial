import { EmptyState } from '../../components/ui/EmptyState'
import type { FileRecord } from '../../types'

const DEMO_FILES: FileRecord[] = [
  { id: 'f1', name: 'Logotipo_Vertice_Final.ai', url: '#', mimeType: 'application/illustrator', size: 4200000, customerId: 'customer-1', orderId: 'o1', category: 'order', uploadedBy: 'admin-1', uploaderRole: 'admin', createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString() },
  { id: 'f2', name: 'Manual_da_Marca.pdf', url: '#', mimeType: 'application/pdf', size: 8100000, customerId: 'customer-1', orderId: 'o1', category: 'order', uploadedBy: 'admin-1', uploaderRole: 'admin', createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() },
  { id: 'f3', name: 'Fotos_Produto_Final.zip', url: '#', mimeType: 'application/zip', size: 350000000, customerId: 'customer-1', orderId: 'o2', category: 'order', uploadedBy: 'admin-1', uploaderRole: 'admin', createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString() },
]

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const MIME_ICON: Record<string, string> = {
  'application/pdf': '📄',
  'application/zip': '📦',
  'application/illustrator': '🎨',
  'image/jpeg': '🖼',
  'image/png': '🖼',
  'video/mp4': '🎬',
}

export function FilesPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: '#f0f0f2' }}>Meus Arquivos</h1>
        <p className="text-sm" style={{ color: '#6b6b78' }}>Arquivos enviados pela equipe Play Moments</p>
      </div>

      {DEMO_FILES.length === 0 ? (
        <EmptyState icon="📁" title="Nenhum arquivo ainda" description="Os arquivos dos seus projetos aparecerão aqui." />
      ) : (
        <div className="flex flex-col gap-2">
          {DEMO_FILES.map(file => (
            <div key={file.id} className="flex items-center gap-4 p-4 rounded-2xl"
              style={{ background: '#141416', border: '1px solid rgba(255,255,255,0.07)' }}>
              <span className="text-3xl flex-shrink-0">{MIME_ICON[file.mimeType] ?? '📄'}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate" style={{ color: '#f0f0f2' }}>{file.name}</p>
                <p className="text-xs" style={{ color: '#6b6b78' }}>
                  {formatBytes(file.size)} · {new Date(file.createdAt).toLocaleDateString('pt-BR')}
                </p>
              </div>
              <a href={file.url}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                style={{ background: 'rgba(255,255,255,0.06)', color: '#f0f0f2', border: '1px solid rgba(255,255,255,0.1)' }}>
                Baixar
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

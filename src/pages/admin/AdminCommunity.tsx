import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { useToast } from '../../contexts/ToastContext'
import { Badge } from '../../components/ui/Badge'

const DEMO_POSTS = [
  { id: '1', title: 'Projeto Vertice entregue!', type: 'project', reactions: 28, comments: 3, active: true, createdAt: '2024-09-24' },
  { id: '2', title: 'Setup instalado no cliente', type: 'news', reactions: 10, comments: 1, active: true, createdAt: '2024-09-23' },
  { id: '3', title: 'Portal do cliente lançado!', type: 'announcement', reactions: 45, comments: 12, active: true, createdAt: '2024-09-20' },
]

const TYPE_LABEL: Record<string, string> = {
  announcement: 'Comunicado',
  news: 'Novidade',
  project: 'Projeto',
  product: 'Produto',
  service: 'Serviço',
  promotion: 'Promoção',
}

export function AdminCommunity() {
  const toast = useToast()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title: '', content: '', type: 'news' })
  const [posts, setPosts] = useState(DEMO_POSTS)

  const handlePublish = () => {
    if (!form.content.trim()) { toast('Escreva o conteúdo.', 'warning'); return }
    setPosts(prev => [
      { id: Date.now().toString(), title: form.title, type: form.type, reactions: 0, comments: 0, active: true, createdAt: new Date().toISOString().split('T')[0] },
      ...prev,
    ])
    setForm({ title: '', content: '', type: 'news' })
    setShowForm(false)
    toast('Publicação criada com sucesso!', 'success')
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#f0f0f2' }}>Comunidade</h1>
          <p className="text-sm" style={{ color: '#6b6b78' }}>Gerenciar publicações do Mural</p>
        </div>
        <Button onClick={() => setShowForm(v => !v)}>+ Nova publicação</Button>
      </div>

      {showForm && (
        <div className="mb-6 p-5 rounded-2xl" style={{ background: '#141416', border: '1px solid rgba(255,255,255,0.1)' }}>
          <h3 className="font-bold mb-4" style={{ color: '#f0f0f2' }}>Nova publicação</h3>
          <div className="flex flex-col gap-3">
            <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}
              className="px-4 py-2.5 rounded-xl text-sm outline-none"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#f0f0f2' }}>
              {Object.entries(TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="Título (opcional)"
              className="px-4 py-2.5 rounded-xl text-sm outline-none"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#f0f0f2' }} />
            <textarea value={form.content} onChange={e => setForm(p => ({ ...p, content: e.target.value }))} placeholder="Conteúdo da publicação..." rows={4}
              className="px-4 py-2.5 rounded-xl text-sm outline-none resize-none"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#f0f0f2' }} />
            <div className="flex gap-2">
              <Button onClick={handlePublish}>Publicar</Button>
              <Button variant="ghost" onClick={() => setShowForm(false)}>Cancelar</Button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {posts.map(post => (
          <div key={post.id} className="flex items-center justify-between px-5 py-4 rounded-2xl"
            style={{ background: '#141416', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="default">{TYPE_LABEL[post.type] ?? post.type}</Badge>
                {!post.active && <Badge variant="danger">Oculto</Badge>}
              </div>
              <p className="text-sm font-semibold" style={{ color: '#f0f0f2' }}>
                {post.title || '(Sem título)'}
              </p>
              <p className="text-xs mt-1" style={{ color: '#6b6b78' }}>
                {new Date(post.createdAt).toLocaleDateString('pt-BR')} · {post.reactions} reações · {post.comments} comentários
              </p>
            </div>
            <div className="flex gap-2">
              <button className="text-xs px-3 py-1.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.06)', color: '#9090a0' }}>Editar</button>
              <button className="text-xs px-3 py-1.5 rounded-lg" style={{ background: 'rgba(227,6,19,0.1)', color: '#ff6b7a', border: '1px solid rgba(227,6,19,0.2)' }}>Ocultar</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

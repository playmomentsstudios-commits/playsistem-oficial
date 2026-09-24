import { useState, useEffect } from 'react'
import { PublicLayout } from '../../layouts/PublicLayout'
import { PostCard } from '../../components/community/PostCard'
import { CardSkeleton } from '../../components/ui/Skeleton'
import { EmptyState } from '../../components/ui/EmptyState'
import type { Post } from '../../types'

// Seed posts — replaced when backend is connected
const SEED_POSTS: Post[] = [
  {
    id: '1',
    authorId: 'admin-1',
    authorName: 'Play Moments',
    authorRole: 'Studio & Criação',
    authorAvatar: '▶',
    type: 'project',
    title: 'Projeto Vertice entregue com sucesso!',
    content: 'Identidade visual completa para a marca Vertice — logotipo, paleta, tipografia e motion design. Três semanas de trabalho intenso com um resultado que superou todas as expectativas do cliente.',
    image: 'https://images.unsplash.com/photo-1634942537034-2531766767d1?w=800&h=400&fit=crop&auto=format',
    reactions: { '🔥': 14, '❤️': 9, '🚀': 5 },
    commentsCount: 3,
    featured: true,
    active: true,
    createdAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '2',
    authorId: 'admin-1',
    authorName: 'Equipe Tech',
    authorRole: 'Tech & Equipamentos',
    authorAvatar: '⚡',
    type: 'news',
    content: 'Setup completo instalado no novo estúdio do cliente! Câmeras 4K, iluminação profissional e infraestrutura de streaming. Tudo calibrado e pronto para produzir conteúdo de alto nível.',
    reactions: { '👏': 7, '😍': 3 },
    commentsCount: 1,
    featured: false,
    active: true,
    createdAt: new Date(Date.now() - 35 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '3',
    authorId: 'admin-1',
    authorName: 'Design Digital',
    authorRole: 'Design & Digital',
    authorAvatar: '✦',
    type: 'promotion',
    title: 'Nova landing page com conversão 47% acima da média',
    content: 'UX pesquisado, copywriting estratégico e animações que guiam o olho do visitante até o CTA. Resultado: 47% de conversão acima da média do setor para o nosso cliente.',
    reactions: { '💡': 11, '🎯': 6, '🔥': 2 },
    commentsCount: 5,
    featured: false,
    active: true,
    createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '4',
    authorId: 'admin-1',
    authorName: 'Play Moments',
    authorRole: 'Comunicado',
    authorAvatar: '▶',
    type: 'announcement',
    title: '🎉 Portal do cliente lançado!',
    content: 'A partir de agora você pode acompanhar pedidos, trocar arquivos e conversar com a equipe diretamente pela plataforma. Sem WhatsApp, sem e-mail perdido. Tudo em um lugar.',
    reactions: { '🚀': 22, '❤️': 15, '👏': 8 },
    commentsCount: 12,
    featured: true,
    active: true,
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
]

export function CommunityPage() {
  const [posts, setPosts] = useState<Post[]>([])
  const [myReactions, setMyReactions] = useState<Record<string, string | null>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Simulate API call — replace with postsApi.list() when backend ready
    const timer = setTimeout(() => {
      setPosts(SEED_POSTS)
      setLoading(false)
    }, 600)
    return () => clearTimeout(timer)
  }, [])

  const handleReact = (postId: string, emoji: string) => {
    setMyReactions(prev => {
      const current = prev[postId]
      return { ...prev, [postId]: current === emoji ? null : emoji }
    })
    setPosts(prev => prev.map(p => {
      if (p.id !== postId) return p
      const current = myReactions[postId]
      const newReactions = { ...p.reactions }
      if (current) newReactions[current] = Math.max(0, (newReactions[current] ?? 1) - 1)
      if (current !== emoji) newReactions[emoji] = (newReactions[emoji] ?? 0) + 1
      return { ...p, reactions: newReactions, myReaction: current === emoji ? undefined : emoji }
    }))
  }

  return (
    <PublicLayout>
      <div className="mx-auto px-4 py-12" style={{ maxWidth: 640 }}>
        {/* Header */}
        <div className="text-center mb-12">
          <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: '#E30613', letterSpacing: '0.2em' }}>
            Comunidade
          </p>
          <h1 className="text-4xl font-bold mb-4" style={{
            background: 'linear-gradient(135deg, #fff 40%, #6b6b78 100%)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'
          }}>
            Mural Play Moments
          </h1>
          <p className="text-sm" style={{ color: '#6b6b78', lineHeight: 1.7 }}>
            Novidades, projetos, comunicados e muito mais direto da nossa equipe.
          </p>
        </div>

        {/* Posts */}
        {loading ? (
          <div className="flex flex-col gap-5">
            {[1, 2, 3].map(n => <CardSkeleton key={n} />)}
          </div>
        ) : posts.length === 0 ? (
          <EmptyState icon="📭" title="Nenhuma publicação ainda" description="Em breve a equipe Play Moments publicará novidades aqui." />
        ) : (
          <div className="flex flex-col gap-5">
            {posts.map((post, i) => (
              <PostCard
                key={post.id}
                post={{ ...post, myReaction: myReactions[post.id] ?? post.myReaction }}
                onReact={handleReact}
                style={{ animation: `slide-in-left 0.5s ease both`, animationDelay: `${i * 80}ms` }}
              />
            ))}
          </div>
        )}
      </div>
    </PublicLayout>
  )
}

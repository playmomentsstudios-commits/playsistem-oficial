import { ReactionPicker } from './ReactionPicker'
import type { Post } from '../../types'

interface PostCardProps {
  post: Post
  onReact: (postId: string, emoji: string) => void
  style?: React.CSSProperties
}

export function PostCard({ post, onReact, style }: PostCardProps) {
  const timeAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime()
    const m = Math.floor(diff / 60000)
    if (m < 1) return 'agora'
    if (m < 60) return `${m}min atrás`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h}h atrás`
    return `${Math.floor(h / 24)}d atrás`
  }

  return (
    <article className="rounded-2xl overflow-hidden" style={{
      background: 'linear-gradient(145deg, #1a1a1f 0%, #141416 100%)',
      border: '1px solid rgba(255,255,255,0.07)',
      boxShadow: '0 4px 32px rgba(0,0,0,0.4)',
      ...style,
    }}>
      {post.image && (
        <div className="relative overflow-hidden" style={{ height: 220, background: '#1a1a1f' }}>
          <img src={post.image} alt={post.title ?? 'Post'} className="w-full h-full object-cover" style={{ opacity: 0.85 }} />
          <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(20,20,22,0.9) 0%, transparent 60%)' }} />
        </div>
      )}

      <div className="p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex items-center justify-center rounded-xl font-bold flex-shrink-0"
            style={{ width: 42, height: 42, background: 'linear-gradient(135deg, #E30613, #ff4d6d)', color: '#fff', fontSize: 18 }}>
            {post.authorAvatar ?? post.authorName.charAt(0)}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm" style={{ color: '#f0f0f2' }}>{post.authorName}</p>
            <p className="text-xs" style={{ color: '#6b6b78' }}>
              {post.authorRole} · {timeAgo(post.createdAt)}
            </p>
          </div>
        </div>

        {post.title && (
          <h3 className="font-bold text-base mb-2" style={{ color: '#f0f0f2' }}>{post.title}</h3>
        )}

        <p className="text-sm leading-relaxed mb-5" style={{ color: '#c0c0cc' }}>{post.content}</p>

        <div className="mb-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }} />

        <ReactionPicker
          postId={post.id}
          counts={post.reactions}
          myReaction={post.myReaction}
          onReact={onReact}
        />
      </div>
    </article>
  )
}

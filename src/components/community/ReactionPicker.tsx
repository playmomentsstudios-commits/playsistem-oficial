import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'

const REACTIONS = [
  { emoji: '❤️', label: 'Amei', color: '#ff4d6d' },
  { emoji: '🔥', label: 'Incrível', color: '#ff6b35' },
  { emoji: '😍', label: 'Uau', color: '#ffd166' },
  { emoji: '👏', label: 'Parabéns', color: '#06d6a0' },
  { emoji: '🚀', label: 'Demais', color: '#4cc9f0' },
  { emoji: '😂', label: 'Haha', color: '#f72585' },
  { emoji: '💡', label: 'Ideia', color: '#b5e48c' },
  { emoji: '🎯', label: 'Perfeito', color: '#E30613' },
]

interface ReactionPickerProps {
  postId: string
  counts: Record<string, number>
  myReaction?: string | null
  onReact: (postId: string, emoji: string) => void
}

export function ReactionPicker({ postId, counts, myReaction, onReact }: ReactionPickerProps) {
  const [open, setOpen] = useState(false)
  const [hoveredLabel, setHoveredLabel] = useState<string | null>(null)
  const { isAuthenticated } = useAuth()
  const toast = useToast()
  const pickerRef = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (!pickerRef.current?.contains(e.target as Node) && !btnRef.current?.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const handleReact = useCallback((emoji: string) => {
    if (!isAuthenticated) {
      toast('Faça login para reagir às publicações.', 'info')
      setOpen(false)
      return
    }
    onReact(postId, emoji)
    setOpen(false)
  }, [isAuthenticated, postId, onReact, toast])

  const totalReactions = Object.values(counts).reduce((a, b) => a + b, 0)

  return (
    <div className="relative">
      {totalReactions > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {Object.entries(counts)
            .filter(([, c]) => c > 0)
            .sort(([, a], [, b]) => b - a)
            .map(([emoji, count]) => {
              const isMe = myReaction === emoji
              return (
                <button
                  key={emoji}
                  onClick={() => handleReact(emoji)}
                  className="count-appear flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium transition-all duration-200"
                  style={{
                    background: isMe ? 'rgba(227,6,19,0.18)' : 'rgba(255,255,255,0.06)',
                    border: `1px solid ${isMe ? 'rgba(227,6,19,0.5)' : 'rgba(255,255,255,0.1)'}`,
                    color: isMe ? '#ff6b7a' : '#c0c0cc',
                  }}
                >
                  <span style={{ lineHeight: 1 }}>{emoji}</span>
                  <span>{count}</span>
                </button>
              )
            })}
        </div>
      )}

      <button
        ref={btnRef}
        onClick={() => isAuthenticated ? (myReaction ? handleReact(myReaction) : setOpen(v => !v)) : toast('Faça login para reagir.', 'info')}
        onMouseEnter={() => isAuthenticated && !myReaction && setOpen(true)}
        className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 select-none"
        style={{
          background: open || myReaction ? 'rgba(227,6,19,0.15)' : 'rgba(255,255,255,0.05)',
          border: `1px solid ${open || myReaction ? 'rgba(227,6,19,0.4)' : 'rgba(255,255,255,0.1)'}`,
          color: myReaction ? '#ff6b7a' : '#9090a0',
        }}
      >
        <span style={{ fontSize: 16, lineHeight: 1, display: 'inline-block' }}>
          {myReaction ?? '😊'}
        </span>
        <span>{myReaction ? 'Reagiu' : 'Reagir'}</span>
      </button>

      {open && (
        <div
          ref={pickerRef}
          onMouseLeave={() => { setOpen(false); setHoveredLabel(null) }}
          className="picker-appear absolute bottom-full mb-3 left-0 z-40"
        >
          <div className="text-center mb-2 text-xs font-semibold tracking-widest uppercase transition-all duration-150"
            style={{ color: hoveredLabel ? '#fff' : 'transparent', height: 18, letterSpacing: '0.12em' }}>
            {hoveredLabel}
          </div>
          <div className="flex items-center gap-1 px-3 py-3 rounded-2xl"
            style={{
              background: 'rgba(20,20,22,0.98)',
              border: '1px solid rgba(255,255,255,0.1)',
              backdropFilter: 'blur(24px)',
              boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
            }}>
            {REACTIONS.map((r, i) => (
              <button key={r.emoji}
                className="emoji-btn relative flex items-center justify-center rounded-xl"
                style={{ animationDelay: `${i * 35}ms`, width: 44, height: 44, fontSize: 24, lineHeight: 1, background: 'transparent', border: 'none', cursor: 'pointer', transition: 'transform 0.15s, background 0.15s' }}
                onMouseEnter={e => {
                  setHoveredLabel(r.label)
                  const el = e.currentTarget
                  el.style.transform = 'scale(1.5) rotate(-8deg)'
                  el.style.background = `${r.color}22`
                }}
                onMouseLeave={e => {
                  setHoveredLabel(null)
                  const el = e.currentTarget
                  el.style.transform = ''
                  el.style.background = 'transparent'
                }}
                onClick={() => handleReact(r.emoji)}
              >
                {r.emoji}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

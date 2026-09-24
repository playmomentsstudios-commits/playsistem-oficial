import { Link } from 'react-router-dom'
import { Badge } from '../../components/ui/Badge'
import { EmptyState } from '../../components/ui/EmptyState'
import type { QuoteStatus } from '../../types'

const DEMO_QUOTES = [
  { id: 'q1', quoteNumber: 'ORC-000001', description: 'Produção de Vídeo Institucional', total: 480000, status: 'sent' as QuoteStatus, validUntil: '2024-10-30', createdAt: '2024-09-20' },
  { id: 'q2', quoteNumber: 'ORC-000002', description: 'Identidade Visual + Site', total: 750000, status: 'viewed' as QuoteStatus, validUntil: '2024-11-05', createdAt: '2024-09-18' },
]

const QUOTE_STATUS_MAP: Record<QuoteStatus, { label: string; variant: 'default' | 'info' | 'success' | 'danger' | 'warning' }> = {
  draft: { label: 'Rascunho', variant: 'default' },
  sent: { label: 'Aguardando revisão', variant: 'info' },
  viewed: { label: 'Visualizado', variant: 'warning' },
  accepted: { label: 'Aceito', variant: 'success' },
  rejected: { label: 'Recusado', variant: 'danger' },
  expired: { label: 'Expirado', variant: 'danger' },
}

function formatPrice(cents: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100)
}

export function QuotesPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: '#f0f0f2' }}>Orçamentos</h1>
        <p className="text-sm" style={{ color: '#6b6b78' }}>Orçamentos enviados pela equipe Play Moments</p>
      </div>

      {DEMO_QUOTES.length === 0 ? (
        <EmptyState icon="📋" title="Nenhum orçamento" description="Solicite um serviço e receba um orçamento aqui." />
      ) : (
        <div className="flex flex-col gap-3">
          {DEMO_QUOTES.map(q => {
            const status = QUOTE_STATUS_MAP[q.status]
            return (
              <div key={q.id} className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl"
                style={{ background: '#141416', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div>
                  <p className="font-bold text-sm" style={{ color: '#E30613' }}>{q.quoteNumber}</p>
                  <p className="text-sm mb-1" style={{ color: '#f0f0f2' }}>{q.description}</p>
                  <p className="text-xs" style={{ color: '#6b6b78' }}>
                    Válido até {new Date(q.validUntil).toLocaleDateString('pt-BR')}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <Badge variant={status.variant}>{status.label}</Badge>
                  <span className="font-bold text-lg" style={{ color: '#f0f0f2' }}>{formatPrice(q.total)}</span>
                  {q.status === 'sent' || q.status === 'viewed' ? (
                    <div className="flex gap-2">
                      <button className="px-3 py-1.5 rounded-lg text-sm font-semibold"
                        style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399', border: '1px solid rgba(16,185,129,0.3)' }}>
                        Aceitar
                      </button>
                      <button className="px-3 py-1.5 rounded-lg text-sm font-semibold"
                        style={{ background: 'rgba(227,6,19,0.1)', color: '#ff6b7a', border: '1px solid rgba(227,6,19,0.2)' }}>
                        Recusar
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

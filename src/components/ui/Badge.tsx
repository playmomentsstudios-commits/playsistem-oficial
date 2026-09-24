import type { ReactNode } from 'react'

type Variant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'brand'

const STYLES: Record<Variant, { bg: string; color: string; border: string }> = {
  default: { bg: 'rgba(255,255,255,0.06)', color: '#c0c0cc', border: 'rgba(255,255,255,0.1)' },
  success: { bg: 'rgba(16,185,129,0.12)', color: '#34d399', border: 'rgba(16,185,129,0.3)' },
  warning: { bg: 'rgba(245,158,11,0.12)', color: '#fbbf24', border: 'rgba(245,158,11,0.3)' },
  danger: { bg: 'rgba(227,6,19,0.12)', color: '#ff6b7a', border: 'rgba(227,6,19,0.3)' },
  info: { bg: 'rgba(76,201,240,0.12)', color: '#67d7f0', border: 'rgba(76,201,240,0.3)' },
  brand: { bg: 'rgba(227,6,19,0.15)', color: '#ff4d5e', border: 'rgba(227,6,19,0.4)' },
}

const ORDER_STATUS_MAP: Record<string, Variant> = {
  pending: 'warning',
  awaiting_payment: 'warning',
  paid: 'info',
  processing: 'info',
  in_production: 'info',
  ready: 'success',
  completed: 'success',
  cancelled: 'danger',
  refunded: 'danger',
}

const ORDER_STATUS_LABEL: Record<string, string> = {
  pending: 'Pendente',
  awaiting_payment: 'Aguardando pagamento',
  paid: 'Pago',
  processing: 'Em processamento',
  in_production: 'Em produção',
  ready: 'Pronto',
  completed: 'Concluído',
  cancelled: 'Cancelado',
  refunded: 'Reembolsado',
}

export function Badge({ children, variant = 'default' }: { children: ReactNode; variant?: Variant }) {
  const s = STYLES[variant]
  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}
    >
      {children}
    </span>
  )
}

export function OrderStatusBadge({ status }: { status: string }) {
  return (
    <Badge variant={ORDER_STATUS_MAP[status] ?? 'default'}>
      {ORDER_STATUS_LABEL[status] ?? status}
    </Badge>
  )
}

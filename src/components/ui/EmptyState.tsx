import type { ReactNode } from 'react'
import { Button } from './Button'

interface EmptyStateProps {
  icon?: string
  title: string
  description?: string
  action?: { label: string; onClick: () => void }
  children?: ReactNode
}

export function EmptyState({ icon = '📭', title, description, action, children }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="text-5xl mb-4" style={{ filter: 'grayscale(0.3)' }}>{icon}</div>
      <h3 className="text-lg font-semibold mb-2" style={{ color: '#c0c0cc' }}>{title}</h3>
      {description && <p className="text-sm max-w-xs mb-6" style={{ color: '#6b6b78', lineHeight: 1.7 }}>{description}</p>}
      {action && <Button onClick={action.onClick}>{action.label}</Button>}
      {children}
    </div>
  )
}

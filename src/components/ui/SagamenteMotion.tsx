import type { CSSProperties } from 'react'
import './SagamenteMotion.css'

const segments = [
  { color: '#B24B18', d: 'M 0 24.14 L 48.52 0 L 48.52 25.33 L 25.74 36.95 Z' },
  { color: '#FFFFFF', d: 'M 51.48 0 L 100 24.14 L 100 49.48 L 51.48 25.04 Z' },
  { color: '#FFFFFF', d: 'M 0 24.14 L 48.52 48.59 L 48.52 73.92 L 0 49.48 Z' },
  { color: '#B24B18', d: 'M 51.48 50.37 L 100 74.22 L 74.55 86.46 L 51.48 75.41 Z' },
  { color: '#B24B18', d: 'M 0 74.22 L 48.52 98.70 L 48.52 124 L 0 99.80 Z' },
  { color: '#FFFFFF', d: 'M 51.48 98.95 L 100 74.52 L 100 99.80 L 51.48 124 Z' }
]

type Props = { size?: number; className?: string; label?: string; monochrome?: string; animate?: boolean }

/** Six original brand paths; CSS-only animation and reduced-motion support. */
export function SagamenteMotion({ size = 48, className = '', label, monochrome, animate = true }: Props) {
  return <svg viewBox="0 0 100 124" width={size * 100 / 124} height={size}
    className={['sagamente-motion', animate ? 'sagamente-motion--active' : '', className].filter(Boolean).join(' ')}
    role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
    {segments.map((segment, index) => <path key={index} d={segment.d} fill={monochrome || segment.color}
      className="sagamente-motion__segment" style={{ '--saga-step': index } as CSSProperties} />)}
  </svg>
}

const statusColors: Record<string, string> = {
  active: '#F28C38', in_progress: '#F28C38', completed: '#34D399',
  review: '#60A5FA', paused: '#FBBF24', planning: '#A1A1AA',
  pending: '#FBBF24', cancelled: '#F87171'
}
export function ProjectStatusMark({ status }: { status: string }) {
  const color = statusColors[status] || '#A1A1AA'
  return <span className="sagamente-status-mark" style={{ color }} aria-hidden="true">
    <SagamenteMotion size={13} monochrome="currentColor" animate={true} />
  </span>
}

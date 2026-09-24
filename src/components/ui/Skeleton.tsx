interface SkeletonProps {
  width?: string | number
  height?: string | number
  className?: string
  rounded?: boolean
}

export function Skeleton({ width, height, className = '', rounded = false }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse ${className}`}
      style={{
        width,
        height: height ?? 16,
        background: 'linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 75%)',
        backgroundSize: '200% 100%',
        animation: 'shimmer 1.5s infinite',
        borderRadius: rounded ? 9999 : 8,
      }}
    />
  )
}

export function CardSkeleton() {
  return (
    <div className="rounded-2xl p-5" style={{ background: '#141416', border: '1px solid rgba(255,255,255,0.07)' }}>
      <div className="flex items-center gap-3 mb-4">
        <Skeleton width={42} height={42} rounded />
        <div className="flex flex-col gap-2 flex-1">
          <Skeleton width="60%" />
          <Skeleton width="40%" height={12} />
        </div>
      </div>
      <Skeleton height={14} className="mb-2" />
      <Skeleton height={14} width="85%" className="mb-2" />
      <Skeleton height={14} width="70%" />
    </div>
  )
}

import type { ReactNode, ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
  children: ReactNode
  fullWidth?: boolean
}

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-[#E30613] hover:bg-[#b30010] text-white border-transparent',
  secondary: 'bg-[rgba(255,255,255,0.08)] hover:bg-[rgba(255,255,255,0.12)] text-[#f0f0f2] border-[rgba(255,255,255,0.1)]',
  ghost: 'bg-transparent hover:bg-[rgba(255,255,255,0.06)] text-[#9090a0] border-transparent',
  danger: 'bg-[rgba(227,6,19,0.15)] hover:bg-[rgba(227,6,19,0.25)] text-[#ff6b7a] border-[rgba(227,6,19,0.3)]',
  outline: 'bg-transparent hover:bg-[rgba(255,255,255,0.06)] text-[#f0f0f2] border-[rgba(255,255,255,0.2)]',
}

const SIZES: Record<Size, string> = {
  sm: 'px-3 py-2 text-xs rounded-lg min-h-10',
  md: 'px-4 py-2.5 text-sm rounded-xl min-h-11',
  lg: 'px-6 py-3 text-base rounded-xl min-h-12',
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  children,
  fullWidth = false,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={`
        inline-flex items-center justify-center gap-2 font-semibold border
        transition-all duration-200 select-none cursor-pointer
        disabled:opacity-50 disabled:cursor-not-allowed
        ${VARIANTS[variant]} ${SIZES[size]} ${fullWidth ? 'w-full' : ''} ${className}
      `}
    >
      {loading && (
        <svg className="animate-spin" width="14" height="14" viewBox="0 0 14 14" fill="none">
          <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="2" strokeOpacity=".3" />
          <path d="M12 7a5 5 0 0 0-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      )}
      {children}
    </button>
  )
}

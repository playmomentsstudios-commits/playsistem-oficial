import type { InputHTMLAttributes, ReactNode } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
  leftIcon?: ReactNode
}

export function Input({ label, error, hint, leftIcon, className = '', ...props }: InputProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-xs font-semibold" style={{ color: '#9090a0', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          {label}
        </label>
      )}
      <div className="relative">
        {leftIcon && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6b6b78]">
            {leftIcon}
          </span>
        )}
        <input
          {...props}
          className={`
            w-full rounded-xl px-4 py-2.5 text-sm font-medium
            outline-none transition-all duration-200
            ${leftIcon ? 'pl-10' : ''}
            ${error ? 'border-[rgba(227,6,19,0.5)]' : ''}
            ${className}
          `}
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: `1px solid ${error ? 'rgba(227,6,19,0.4)' : 'rgba(255,255,255,0.1)'}`,
            color: '#f0f0f2',
            ...props.style,
          }}
          onFocus={e => {
            e.target.style.border = `1px solid ${error ? 'rgba(227,6,19,0.6)' : 'rgba(227,6,19,0.5)'}`
            e.target.style.background = 'rgba(255,255,255,0.07)'
          }}
          onBlur={e => {
            e.target.style.border = `1px solid ${error ? 'rgba(227,6,19,0.4)' : 'rgba(255,255,255,0.1)'}`
            e.target.style.background = 'rgba(255,255,255,0.05)'
          }}
        />
      </div>
      {error && <p className="text-xs" style={{ color: '#ff6b7a' }}>{error}</p>}
      {hint && !error && <p className="text-xs" style={{ color: '#6b6b78' }}>{hint}</p>}
    </div>
  )
}

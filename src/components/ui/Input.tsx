import type { InputHTMLAttributes, ReactNode } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
  left?: ReactNode
}

export function Input({ label, error, hint, left, className = '', ...props }: InputProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-sm font-medium text-text-secondary">
          {label}
        </label>
      )}
      <div className="relative">
        {left && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-text-disabled">
            {left}
          </div>
        )}
        <input
          className={`
            w-full bg-secondary border rounded-xl px-4 py-2.5 text-sm text-text
            placeholder:text-text-disabled
            outline-none transition-all duration-150
            ${error
              ? 'border-error/50 focus:border-error'
              : 'border-elevated focus:border-primary/50'
            }
            ${left ? 'pl-10' : ''}
            ${className}
          `}
          {...props}
        />
      </div>
      {error && <p className="text-xs text-error">{error}</p>}
      {hint && !error && <p className="text-xs text-text-disabled">{hint}</p>}
    </div>
  )
}

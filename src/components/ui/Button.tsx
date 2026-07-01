import type { ReactNode } from 'react'

interface ButtonProps {
  children: ReactNode
  onClick?: () => void
  disabled?: boolean
  variant?: 'primary' | 'secondary' | 'danger'
  type?: 'button' | 'submit'
  className?: string
}

export function Button({
  children,
  onClick,
  disabled = false,
  variant = 'primary',
  type = 'button',
  className = '',
}: ButtonProps) {
  const baseClasses =
    'px-4 py-2.5 rounded-lg font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed'

  const variantClasses = {
    primary: 'bg-[var(--lagoon-deep)] text-white hover:bg-[var(--lagoon)]',
    secondary: 'bg-[var(--sand)] text-[var(--sea-ink)] hover:bg-[var(--foam)]',
    danger: 'bg-red-500 text-white hover:bg-red-600',
  }

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
    >
      {children}
    </button>
  )
}

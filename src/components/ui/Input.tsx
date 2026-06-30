interface InputProps {
  type?: string
  placeholder?: string
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  className?: string
}

export function Input({
  type = 'text',
  placeholder = '',
  value,
  onChange,
  disabled = false,
  className = '',
}: InputProps) {
  const baseClasses =
    'w-full px-4 py-2.5 rounded-lg border border-[var(--line)] bg-white text-[var(--sea-ink)] placeholder-[var(--sea-ink-soft)] transition focus:outline-none focus:border-[var(--lagoon-deep)]'

  return (
    <input
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className={`${baseClasses} ${className}`}
      autoComplete="off"
    />
  )
}

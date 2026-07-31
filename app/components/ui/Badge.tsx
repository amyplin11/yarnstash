interface BadgeProps {
  text: string
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'info' | 'queued' | 'in-progress' | 'completed' | 'frogged'
  className?: string
}

export function Badge({ text, variant = 'primary', className = '' }: BadgeProps) {
  const variantStyles = {
    primary: 'bg-terracotta-soft text-terracotta-deep',
    secondary: 'bg-parchment-deep text-ink-muted',
    success: 'bg-sage-soft text-sage-deep',
    warning: 'bg-honey-soft text-honey',
    info: 'bg-sand-soft text-ink-muted',
    queued: 'bg-parchment-deep text-ink-muted',
    'in-progress': 'bg-honey-soft text-honey',
    completed: 'bg-sage-soft text-sage-deep',
    frogged: 'bg-clay-soft text-clay',
  }

  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold tracking-wide ${variantStyles[variant]} ${className}`}
    >
      {text}
    </span>
  )
}

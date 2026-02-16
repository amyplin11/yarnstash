interface BadgeProps {
  text: string
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'info' | 'queued' | 'in-progress' | 'completed' | 'frogged'
  className?: string
}

export function Badge({ text, variant = 'primary', className = '' }: BadgeProps) {
  const variantStyles = {
    primary: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300',
    secondary: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
    success: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    warning: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
    info: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    queued: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    'in-progress': 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
    completed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    frogged: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  }

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${variantStyles[variant]} ${className}`}
    >
      {text}
    </span>
  )
}

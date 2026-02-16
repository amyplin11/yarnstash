import { ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
  onClick?: () => void
}

export function Card({ children, className = '', onClick }: CardProps) {
  const baseStyles = 'bg-background border border-foreground/10 rounded-lg shadow-sm hover:shadow-md transition-shadow'
  const interactiveStyles = onClick ? 'cursor-pointer hover:border-foreground/20' : ''

  return (
    <div
      className={`${baseStyles} ${interactiveStyles} ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  )
}

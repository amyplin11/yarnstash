import { ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
  onClick?: () => void
}

export function Card({ children, className = '', onClick }: CardProps) {
  const baseStyles = 'bg-surface border border-line rounded-3xl shadow-[0_1px_2px_rgba(28,26,23,0.03)] transition-shadow hover:shadow-[0_20px_50px_-35px_rgba(28,26,23,0.6)]'
  const interactiveStyles = onClick ? 'cursor-pointer hover:border-line-strong' : ''

  return (
    <div
      className={`${baseStyles} ${interactiveStyles} ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  )
}

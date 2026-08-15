import type { SVGProps } from 'react'

/**
 * Hand-rolled line icons at a 24px grid, 1.6 stroke — the redesign replaced the
 * emoji glyphs the app used to lean on. All of them inherit `currentColor`.
 */

type IconProps = SVGProps<SVGSVGElement>

function Line({ children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  )
}

export function GridIcon({ className, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className} {...props}>
      <rect x="3" y="3" width="8" height="8" rx="2" />
      <rect x="13" y="3" width="8" height="8" rx="2" />
      <rect x="3" y="13" width="8" height="8" rx="2" />
      <rect x="13" y="13" width="8" height="8" rx="2" />
    </svg>
  )
}

export function ListIcon(props: IconProps) {
  return (
    <Line {...props}>
      <path d="M10 6h11M10 12h11M10 18h11" />
      <path d="M4 5.5h1.2V10" />
      <path d="M3.6 14.2a1.3 1.3 0 0 1 2.3.8c0 1-2.3 1.9-2.3 3.2h2.6" />
    </Line>
  )
}

export function FileIcon(props: IconProps) {
  return (
    <Line {...props}>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" />
    </Line>
  )
}

export function DropletIcon(props: IconProps) {
  return (
    <Line {...props}>
      <path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5S12.5 5.5 12 3c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z" />
    </Line>
  )
}

export function InboxIcon(props: IconProps) {
  return (
    <Line {...props}>
      <rect x="3" y="3" width="18" height="18" rx="3.5" />
      <path d="M12 7.5v6.5" />
      <path d="M9 11l3 3 3-3" />
    </Line>
  )
}

export function ClipboardIcon(props: IconProps) {
  return (
    <Line {...props}>
      <rect x="5" y="4" width="14" height="17" rx="2.5" />
      <path d="M9 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1" />
      <path d="M9 10h6M9 14h6M9 18h3" />
    </Line>
  )
}

export function SpokesIcon(props: IconProps) {
  return (
    <Line {...props}>
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" />
    </Line>
  )
}

export function PackageIcon(props: IconProps) {
  return (
    <Line {...props}>
      <path d="M20.5 7.8v8.4a1.6 1.6 0 0 1-.85 1.42l-6.9 3.6a1.6 1.6 0 0 1-1.5 0l-6.9-3.6A1.6 1.6 0 0 1 3.5 16.2V7.8a1.6 1.6 0 0 1 .85-1.42l6.9-3.6a1.6 1.6 0 0 1 1.5 0l6.9 3.6A1.6 1.6 0 0 1 20.5 7.8z" />
      <path d="M3.8 7 12 11.4 20.2 7" />
      <path d="M12 11.4V21" />
    </Line>
  )
}

export function RulerIcon(props: IconProps) {
  return (
    <Line {...props}>
      <path d="M15.6 2.9 21.1 8.4a1.4 1.4 0 0 1 0 2L10.4 21.1a1.4 1.4 0 0 1-2 0L2.9 15.6a1.4 1.4 0 0 1 0-2L13.6 2.9a1.4 1.4 0 0 1 2 0z" />
      <path d="M13 5.5 15.5 8M10 8.5 12.5 11M7 11.5 9.5 14M5.5 14.5 8 17" />
    </Line>
  )
}

export function PaletteIcon(props: IconProps) {
  return (
    <Line {...props}>
      <path d="M12 21a9 9 0 1 1 9-9c0 1.7-1.3 3-3 3h-1.5a2.2 2.2 0 0 0-1.6 3.7A1.8 1.8 0 0 1 12 21z" />
      <circle cx="7.8" cy="12" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="9.9" cy="8" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="14.4" cy="7.6" r="1.1" fill="currentColor" stroke="none" />
    </Line>
  )
}

export function CloudUploadIcon(props: IconProps) {
  return (
    <Line {...props}>
      <path d="M7 18.5a4.5 4.5 0 0 1-.85-8.92 5.5 5.5 0 0 1 10.55-1.4A4.5 4.5 0 0 1 17.3 18.5" />
      <path d="M12 21v-8.5" />
      <path d="M9 15.5l3-3 3 3" />
    </Line>
  )
}

export function CameraIcon(props: IconProps) {
  return (
    <Line {...props}>
      <path d="M3 8.5A1.5 1.5 0 0 1 4.5 7h2.2a1.5 1.5 0 0 0 1.25-.67l.8-1.2A1.5 1.5 0 0 1 10 4.5h4a1.5 1.5 0 0 1 1.25.67l.8 1.2A1.5 1.5 0 0 0 17.3 7h2.2A1.5 1.5 0 0 1 21 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5z" />
      <circle cx="12" cy="12.75" r="3.4" />
    </Line>
  )
}

export function CheckIcon(props: IconProps) {
  return (
    <Line {...props}>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </Line>
  )
}

export function PlusIcon(props: IconProps) {
  return (
    <Line {...props}>
      <path d="M12 5v14M5 12h14" />
    </Line>
  )
}

export function ArrowRightIcon(props: IconProps) {
  return (
    <Line {...props}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </Line>
  )
}

export function ArrowLeftIcon(props: IconProps) {
  return (
    <Line {...props}>
      <path d="M19 12H5M11 6l-6 6 6 6" />
    </Line>
  )
}

export function TableIcon(props: IconProps) {
  return (
    <Line {...props}>
      <rect x="3" y="4" width="18" height="16" rx="2.5" />
      <path d="M3 9.5h18M3 15h18M9.5 9.5V20" />
    </Line>
  )
}

export function SearchIcon(props: IconProps) {
  return (
    <Line {...props}>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M15.4 15.4 21 21" />
    </Line>
  )
}

export function MessageIcon(props: IconProps) {
  return (
    <Line {...props}>
      <path d="M20 12.5c0 3.6-3.6 6.5-8 6.5a9.6 9.6 0 0 1-2.7-.4L5 20l1.2-3A6.1 6.1 0 0 1 4 12.5C4 8.9 7.6 6 12 6s8 2.9 8 6.5Z" />
      <path d="M9 12.5h.01M12 12.5h.01M15 12.5h.01" />
    </Line>
  )
}

export function LogOutIcon(props: IconProps) {
  return (
    <Line {...props}>
      <path d="M15 3h3.5A1.5 1.5 0 0 1 20 4.5v15a1.5 1.5 0 0 1-1.5 1.5H15" />
      <path d="M10 8l-4 4 4 4" />
      <path d="M6 12h9" />
    </Line>
  )
}

export function LogInIcon(props: IconProps) {
  return (
    <Line {...props}>
      <path d="M9 3H5.5A1.5 1.5 0 0 0 4 4.5v15A1.5 1.5 0 0 0 5.5 21H9" />
      <path d="M15 8l4 4-4 4" />
      <path d="M19 12H9" />
    </Line>
  )
}

export function ChevronsLeftIcon(props: IconProps) {
  return (
    <Line {...props}>
      <path d="M11 6l-6 6 6 6M18 6l-6 6 6 6" />
    </Line>
  )
}

export function ChevronsRightIcon(props: IconProps) {
  return (
    <Line {...props}>
      <path d="M13 6l6 6-6 6M6 6l6 6-6 6" />
    </Line>
  )
}

export function MenuIcon(props: IconProps) {
  return (
    <Line {...props}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </Line>
  )
}

export function CloseIcon(props: IconProps) {
  return (
    <Line {...props}>
      <path d="M6 6l12 12M18 6L6 18" />
    </Line>
  )
}

/** The wordmark tile: a ball of yarn on a dark rounded square. */
export function YarnMark({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center justify-center rounded-2xl bg-ink text-parchment ${className}`}
    >
      <svg viewBox="0 0 24 24" fill="none" className="h-3/5 w-3/5" aria-hidden="true">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth={1.7} />
        <path
          d="M5.2 8.6c3.4.6 6.6 2.6 8.5 5.6M3.6 13.8c3.7-.6 7.4.5 10 3.1M8.8 3.6c1.4 3.5 1.3 7.4-.3 10.7M14.6 3.4c-.3 4.3 1.2 8.4 4.1 11.4"
          stroke="currentColor"
          strokeWidth={1.7}
          strokeLinecap="round"
        />
      </svg>
    </span>
  )
}

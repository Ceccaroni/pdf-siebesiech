import { cn } from '../lib/utils'

/** Nur die Bildmarke (App-Icon). Skaliert von Favicon bis App-Kachel. */
export function LogoMark({
  size = 32,
  className,
  rounded = true,
}: {
  size?: number
  className?: string
  rounded?: boolean
}) {
  const gid = 'siech-bg'
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('shrink-0', className)}
      role="img"
      aria-label="PDF-Siebesiech Logo"
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="48" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ee4d42" />
          <stop offset="1" stopColor="#b8231a" />
        </linearGradient>
      </defs>

      {/* Rote App-Kachel */}
      <rect width="48" height="48" rx={rounded ? 11 : 0} fill={`url(#${gid})`} />

      {/* Zwei „Siech"-Hörnchen hinter dem Dokument (verspielter Wink) */}
      <path d="M16 13 C 14 9, 12.5 7.5, 12 6 C 14.5 6.6, 16.8 8.2, 18.2 11.2 Z" fill="#f9b234" />
      <path d="M32 13 C 34 9, 35.5 7.5, 36 6 C 33.5 6.6, 31.2 8.2, 29.8 11.2 Z" fill="#f9b234" />

      {/* Weisses Dokument */}
      <path
        d="M14 13.5 A2.5 2.5 0 0 1 16.5 11 H29 L34 16 V35.5 A2.5 2.5 0 0 1 31.5 38 H16.5 A2.5 2.5 0 0 1 14 35.5 Z"
        fill="#ffffff"
      />
      {/* Eselsohr / gefaltete Ecke */}
      <path d="M29 11 L34 16 H30.5 A1.5 1.5 0 0 1 29 14.5 Z" fill="#dcdcd8" />

      {/* Angedeutete (editierbare) Textzeilen */}
      <rect x="18" y="20" width="12" height="2" rx="1" fill="#c9c9c3" />
      <rect x="18" y="24.5" width="12" height="2" rx="1" fill="#c9c9c3" />
      <rect x="18" y="29" width="7.5" height="2" rx="1" fill="#ee4d42" />
    </svg>
  )
}

/** Bildmarke + Wortmarke. */
export function Logo({
  size = 30,
  className,
  showWordmark = true,
}: {
  size?: number
  className?: string
  showWordmark?: boolean
}) {
  return (
    <div className={cn('flex items-center gap-2.5 no-select', className)}>
      <LogoMark size={size} />
      {showWordmark && (
        <span className="text-[15px] font-semibold tracking-tight text-ink-900">
          <span className="text-brand-600">PDF</span>
          <span className="text-ink-400">-</span>
          <span>Siebesiech</span>
        </span>
      )}
    </div>
  )
}

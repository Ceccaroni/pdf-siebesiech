import { clsx, type ClassValue } from 'clsx'

export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs)
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB']
  let value = bytes / 1024
  let i = 0
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024
    i++
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[i]}`
}

/** Kürzt einen Dateinamen mittig: "einlangername.pdf" -> "einlan…me.pdf". */
export function truncateMiddle(name: string, max = 28): string {
  if (name.length <= max) return name
  const keep = Math.floor((max - 1) / 2)
  return `${name.slice(0, keep)}…${name.slice(name.length - keep)}`
}

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  // Fallback (sollte in modernen Browsern nie nötig sein).
  return `id-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`
}

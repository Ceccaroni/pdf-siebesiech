import { useMemo } from 'react'
import type { PageDescriptor, SourceDoc } from '../engine/types'
import { useStore } from '../state/store'

/**
 * Herkunftsfarben für mehrere Quell-Dokumente. Bewusst *keine* Rottöne
 * (kollidiert sonst mit der Marken-/Auswahlfarbe). Mittelkräftig, damit die
 * Farbe auch als Text auf hellem Chip lesbar bleibt.
 */
export const DOC_COLORS = [
  '#2563eb', // Blau
  '#16a34a', // Grün
  '#9333ea', // Violett
  '#0d9488', // Teal
  '#ca8a04', // Gold
  '#db2777', // Pink
  '#4f46e5', // Indigo
  '#0891b2', // Cyan
] as const

export interface DocMeta {
  /** Reihenfolge des ersten Auftretens (0-basiert). */
  order: number
  /** Herkunftsfarbe (Hex). */
  color: string
  /** Dateiname der Quelle. */
  name: string
}

/**
 * Ordnet jeder Quelle eine stabile Farbe zu — nach erstem Auftreten in der
 * aktuellen Seitenreihenfolge. So bleibt die Zuordnung ruhig, auch wenn Seiten
 * quer über Dokumente gemischt werden.
 */
export function buildDocMeta(
  pages: PageDescriptor[],
  sources: Map<string, SourceDoc>,
): Map<string, DocMeta> {
  const map = new Map<string, DocMeta>()
  let order = 0
  for (const p of pages) {
    if (map.has(p.docId)) continue
    map.set(p.docId, {
      order,
      color: DOC_COLORS[order % DOC_COLORS.length],
      name: sources.get(p.docId)?.name ?? 'Dokument',
    })
    order++
  }
  return map
}

/** Herkunfts-Metadaten der aktuellen Seiten (leer/1 Eintrag = Einzeldokument). */
export function useDocMeta(): Map<string, DocMeta> {
  const { state } = useStore()
  return useMemo(
    () => buildDocMeta(state.pages, new Map(Object.entries(state.sources))),
    [state.pages, state.sources],
  )
}

import type { TextRun } from './types'

/** Eine zusammenhängende Zeile: mehrere Textläufe auf derselben Baseline, zu einem String vereint. */
interface LineInfo {
  text: string
  nx: number
  ny: number
  right: number
  baseNy: number
  nh: number
  fontSize: number
  fontName: string
}

/**
 * Ein erkannter Absatz: mehrere aufeinanderfolgende Zeilen mit gleicher Schrift,
 * gleichbleibendem linken Rand und normalem Zeilenabstand — oder eine einzelne
 * Zeile (Label, Formularfeld), wenn keine Fortsetzung erkannt wird.
 */
export interface TextBlock {
  /** Fliesstext des Absatzes (Original-Zeilen zu Leerzeichen zusammengeführt). */
  text: string
  nx: number
  ny: number
  nw: number
  nh: number
  /** Grundlinie der ersten Zeile (normalisiert, wie bei TextRun). */
  baseNy: number
  fontSize: number
  fontName: string
  /** Median-Grundlinienabstand (normalisiert); nur bei ≥2 Zeilen gesetzt. */
  lineGap?: number
}

function groupRunsIntoLines(runs: TextRun[]): LineInfo[] {
  const sorted = [...runs].sort((a, b) => a.baseNy - b.baseNy || a.nx - b.nx)
  const rawLines: TextRun[][] = []
  for (const r of sorted) {
    const last = rawLines[rawLines.length - 1]
    const lastRun = last?.[0]
    // Toleranz relativ zur Zeilenhöhe (nh) — seitenhöhen-unabhängig, da nh
    // bereits auf die Seitenhöhe normalisiert ist (wie baseNy).
    if (last && lastRun && Math.abs(r.baseNy - lastRun.baseNy) <= lastRun.nh * 0.35) {
      last.push(r)
    } else {
      rawLines.push([r])
    }
  }
  return rawLines.map((group) => {
    group.sort((a, b) => a.nx - b.nx)
    let text = ''
    let prevRight: number | null = null
    for (const r of group) {
      // Lücke zum Vorlauf grösser als ~15% der Zeilenhöhe → Leerzeichen einfügen
      // (mehrere pdf.js-Läufe pro Zeile, z.B. bei Fett-Wörtern mittendrin).
      if (prevRight != null && r.nx - prevRight > r.nh * 0.15) text += ' '
      text += r.text
      prevRight = r.nx + r.nw
    }
    const dominant = group.reduce((a, b) => (b.nw > a.nw ? b : a))
    return {
      text,
      nx: Math.min(...group.map((r) => r.nx)),
      ny: Math.min(...group.map((r) => r.ny)),
      right: Math.max(...group.map((r) => r.nx + r.nw)),
      baseNy: dominant.baseNy,
      nh: Math.max(...group.map((r) => r.nh)),
      fontSize: dominant.fontSize,
      fontName: dominant.fontName,
    }
  })
}

const LEFT_EDGE_TOL = 0.02 // 2% der Seitenbreite — Toleranz für den linken Rand
const FONT_SIZE_TOL = 0.3 // Punkte

/**
 * Gruppiert Textläufe zu Absätzen: gleiche Schrift/Grösse, konstanter linker
 * Rand und normaler Zeilenabstand (grosse Lücke = neuer Absatz/Abschnitt).
 * Läuft rein geometrisch auf den bereits normalisierten `TextRun`-Feldern —
 * erkennt daher keine Zentrierung oder Erstzeilen-Einzug (Randfall, nicht
 * abgedeckt: solche Zeilen bleiben einzelne Ein-Zeilen-Blöcke).
 */
export function groupTextRunsIntoBlocks(runs: TextRun[]): TextBlock[] {
  const lines = groupRunsIntoLines(runs)
  const blocks: TextBlock[] = []
  let current: LineInfo[] | null = null

  const flush = () => {
    if (!current) return
    const first = current[0]
    const last = current[current.length - 1]
    const nx = Math.min(...current.map((l) => l.nx))
    const right = Math.max(...current.map((l) => l.right))
    let lineGap: number | undefined
    if (current.length > 1) {
      const gaps = current
        .slice(1)
        .map((l, i) => l.baseNy - current![i].baseNy)
        .sort((a, b) => a - b)
      lineGap = gaps[gaps.length >> 1]
    }
    blocks.push({
      text: current.map((l) => l.text).join(' '),
      nx,
      ny: first.ny,
      nw: right - nx,
      nh: last.ny + last.nh - first.ny,
      baseNy: first.baseNy,
      fontSize: first.fontSize,
      fontName: first.fontName,
      lineGap,
    })
    current = null
  }

  for (const line of lines) {
    if (!current) {
      current = [line]
      continue
    }
    const prev = current[current.length - 1]
    const sameFont =
      line.fontName === prev.fontName &&
      Math.abs(line.fontSize - prev.fontSize) <= FONT_SIZE_TOL
    const sameMargin = Math.abs(line.nx - prev.nx) <= LEFT_EDGE_TOL
    const gap = line.baseNy - prev.baseNy
    const normalGap = gap > 0 && gap <= prev.nh * 1.9
    if (sameFont && sameMargin && normalGap) {
      current.push(line)
    } else {
      flush()
      current = [line]
    }
  }
  flush()
  return blocks
}

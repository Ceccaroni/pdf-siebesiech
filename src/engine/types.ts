/** Ein geladenes Quell-PDF. Die Bytes bleiben unverändert (Wahrheitsquelle für Export). */
export interface SourceDoc {
  id: string
  name: string
  bytes: Uint8Array
  pageCount: number
}

/**
 * Eine Seite im Arbeitsdokument. Mehrere Deskriptoren dürfen auf dieselbe
 * Quellseite zeigen (Duplikate). `rotation` ist die vom Nutzer *zusätzlich*
 * aufgebrachte Drehung (0/90/180/270), oben auf die intrinsische Seitendrehung.
 */
export interface PageDescriptor {
  id: string
  docId: string
  sourceIndex: number
  rotation: 0 | 90 | 180 | 270
}

export type Rotation = 0 | 90 | 180 | 270

export function normalizeRotation(deg: number): Rotation {
  const r = ((deg % 360) + 360) % 360
  return (r - (r % 90)) as Rotation
}

// --- Anmerkungen / Bearbeitung (Phase 2) ---
// Positionen sind normalisiert (0..1) ab der linken oberen Ecke der *ungedrehten*
// Seite — auflösungsunabhängig und einfach nach pdf-lib (y-up) umzurechnen.

export type Tool = 'select' | 'text' | 'whiteout' | 'redigieren'

interface BaseAnnotation {
  id: string
  pageId: string
}

/**
 * Beschreibt eine (Original-)Schrift für Vorschau und Export.
 * `approx` = wir haben die echte Familie nicht und nutzen einen Ersatz —
 * die UI weist das ehrlich als „angenähert" aus.
 */
export interface FontSpec {
  family: string // z.B. "Montserrat"
  weight: number // 400 = normal, 700 = fett
  italic: boolean
  approx?: boolean
}

export interface TextAnnotation extends BaseAnnotation {
  kind: 'text'
  nx: number
  ny: number
  fontSize: number // in PDF-Punkten
  color: string // Hex
  text: string
  // --- Korrektur bestehenden PDF-Texts (alle optional; fehlen = freies Textfeld wie bisher) ---
  /** Originalschrift; fehlt → Helvetica (heutiges Verhalten). */
  font?: FontSpec
  /** Deck-Rechteck über dem Originallauf (Weissfläche); fehlt → freistehender Text. */
  box?: { nw: number; nh: number; bg: string }
  /** Exakte Original-Grundlinie (normalisiert, von oben). Gesetzt → Export zeichnet pixelgenau dort. */
  baseNy?: number
  /** Original-Text (für „zurücksetzen"/Referenz). */
  origin?: string
  /** Grundlinienabstand für Mehrzeiler (normalisiert wie `ny`); nur bei aus
   *  mehreren Original-Zeilen zusammengeführten Absätzen gesetzt. Fehlt → size*1.15. */
  lineGap?: number
}

/**
 * Ein ausgelesener Textlauf aus dem Quell-PDF (via pdf.js). Koordinaten wie das
 * Anmerkungs-Modell: normalisiert 0..1 ab oben links der *ungedrehten* Seite.
 * Rohmaterial für das Werkzeug „Text korrigieren" — keine Anmerkung.
 */
export interface TextRun {
  text: string
  nx: number // linke Kante
  ny: number // Oberkante der Textbox
  nw: number // Vorschub-Breite
  nh: number // Zeilenhöhe (ascent..descent)
  baseNy: number // Grundlinie
  fontSize: number // Punkte
  fontName: string // realer PostScript-Name inkl. Subset-Präfix, z.B. "AAAAAB+Montserrat-Regular"
}

export interface RectAnnotation extends BaseAnnotation {
  kind: 'whiteout'
  nx: number
  ny: number
  nw: number
  nh: number
  color: string // Hex
}

export type Annotation = TextAnnotation | RectAnnotation

export const TEXT_COLORS = [
  '#1a1a1a',
  '#db2f24',
  '#1d63c9',
  '#1f9d57',
  '#e08b00',
  '#ffffff',
]

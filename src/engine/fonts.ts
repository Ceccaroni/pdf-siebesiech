/**
 * Schrift-Erkennung, -Matching und -Bereitstellung für „Text korrigieren".
 *
 * Idee: Aus dem realen PDF-Fontnamen (z.B. "AAAAAB+Montserrat-Regular") eine
 * `FontSpec` ableiten — eine gebündelte Familie, die wir *voll* mitliefern
 * (keine Subset-Lücken), oder eine Standard-14-Schrift (via pdf-lib, kein
 * Download). Dieselbe `FontSpec` steuert später Vorschau (FontFace) und Export
 * (Einbettung). Kein Treffer → nächstbeste Familie, ehrlich als `approx` markiert.
 *
 * Bewusst schlank für schwache Geräte: Fontdateien werden **erst bei Bedarf**
 * geladen (kein Precache) und danach vom Service-Worker offline vorgehalten.
 */
import type { FontSpec } from './types'

/** Gebündelte Familien → Dateibasis in `public/fonts/` (je 4 Schnitte). */
const FAMILY_FILE = {
  Montserrat: 'montserrat',
  Carlito: 'carlito',
  Poppins: 'poppins',
  Lato: 'lato',
} as const
type BundledFamily = keyof typeof FAMILY_FILE

/** Standard-14-Familien (pdf-lib-Builtin, kein Download). */
const STANDARD = new Set(['Helvetica', 'Times', 'Courier'])

/**
 * Bekannte Quell-Familien → aufgelöste Zielfamilie.
 * `approx: false` nur, wenn wir die Familie exakt haben oder ein
 * *masskompatibler* Klon vorliegt (Carlito↔Calibri). Bloss „ähnliche" Ersätze
 * sind `approx: true` → die UI weist das als „angenähert" aus.
 * Schlüssel sind normalisiert (klein, ohne Sonderzeichen/Spaces).
 */
const KNOWN: Record<string, { family: string; approx: boolean }> = {
  // Exakt gebündelt
  montserrat: { family: 'Montserrat', approx: false },
  carlito: { family: 'Carlito', approx: false },
  poppins: { family: 'Poppins', approx: false },
  lato: { family: 'Lato', approx: false },
  // Masskompatibler Klon
  calibri: { family: 'Carlito', approx: false },
  // Standard-14 (exakt)
  helvetica: { family: 'Helvetica', approx: false },
  times: { family: 'Times', approx: false },
  timesnewroman: { family: 'Times', approx: false },
  courier: { family: 'Courier', approx: false },
  couriernew: { family: 'Courier', approx: false },
  // Ähnliche Ersätze (angenähert)
  arial: { family: 'Helvetica', approx: true },
  arimo: { family: 'Helvetica', approx: true },
  helveticaneue: { family: 'Helvetica', approx: true },
  tinos: { family: 'Times', approx: true },
  georgia: { family: 'Times', approx: true },
  cambria: { family: 'Times', approx: true },
  cousine: { family: 'Courier', approx: true },
  opensans: { family: 'Lato', approx: true },
  roboto: { family: 'Lato', approx: true },
  segoeui: { family: 'Lato', approx: true },
  verdana: { family: 'Lato', approx: true },
  tahoma: { family: 'Lato', approx: true },
  sourcesanspro: { family: 'Lato', approx: true },
  nunito: { family: 'Poppins', approx: true },
  raleway: { family: 'Montserrat', approx: true },
}

function normalizeKey(family: string): string {
  return family
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .replace(/(psmt|mt|ps)$/, '')
}

/** Style-Wörter am Ende eines geklebten Familiennamens entfernen ("ArialBold"→"Arial"). */
function stripStyleWords(family: string): string {
  return family.replace(
    /(black|heavy|extrabold|ultrabold|semibold|demibold|bold|extralight|ultralight|light|thin|medium|regular|roman|book|italic|oblique)+$/i,
    '',
  )
}

function parseStyle(s: string): { weight: number; italic: boolean } {
  const t = s.toLowerCase()
  const italic = /italic|oblique/.test(t)
  let weight = 400
  if (/black|heavy/.test(t)) weight = 900
  else if (/extrabold|ultrabold/.test(t)) weight = 800
  else if (/semibold|demibold/.test(t)) weight = 600
  else if (/bold/.test(t)) weight = 700
  else if (/medium/.test(t)) weight = 500
  else if (/extralight|ultralight|thin/.test(t)) weight = 200
  else if (/light/.test(t)) weight = 300
  return { weight, italic }
}

/**
 * Realen PDF-Fontnamen → `FontSpec` (aufgelöste Familie + Gewicht/Stil).
 * Beispiel: "AAAAAB+Montserrat-BoldItalic" → {Montserrat, 700, italic}.
 */
export function matchFontName(rawName: string): FontSpec {
  const name = rawName.replace(/^[A-Z]{6}\+/, '') // Subset-Präfix weg
  const dash = name.indexOf('-')
  const familyRaw = dash >= 0 ? name.slice(0, dash) : name
  const { weight, italic } = parseStyle(name)

  let entry = KNOWN[normalizeKey(familyRaw)]
  if (!entry) entry = KNOWN[normalizeKey(stripStyleWords(familyRaw))]

  if (entry) {
    return { family: entry.family, weight, italic, ...(entry.approx && { approx: true }) }
  }
  // Unbekannt → neutraler Sans-Ersatz, ehrlich markiert.
  return { family: 'Helvetica', weight, italic, approx: true }
}

function styleKey(weight: number, italic: boolean): string {
  const bold = weight >= 600
  if (bold && italic) return 'bolditalic'
  if (bold) return 'bold'
  if (italic) return 'italic'
  return 'regular'
}

function fontUrl(base: string, weight: number, italic: boolean): string {
  return `${import.meta.env.BASE_URL}fonts/${base}-${styleKey(weight, italic)}.ttf`
}

export type FontSource =
  | { kind: 'standard'; std: 'Helvetica' | 'Times' | 'Courier'; weight: number; italic: boolean }
  | { kind: 'bundled'; url: string }

/** Wie eine `FontSpec` einzubetten/laden ist (gebündelte TTF vs. Standard-14). */
export function fontSource(spec: FontSpec): FontSource {
  if (STANDARD.has(spec.family)) {
    return {
      kind: 'standard',
      std: spec.family as 'Helvetica' | 'Times' | 'Courier',
      weight: spec.weight,
      italic: spec.italic,
    }
  }
  const base = FAMILY_FILE[spec.family as BundledFamily]
  if (base) return { kind: 'bundled', url: fontUrl(base, spec.weight, spec.italic) }
  // Sollte durch matchFontName nie eintreten — sicher auf Helvetica fallen.
  return { kind: 'standard', std: 'Helvetica', weight: spec.weight, italic: spec.italic }
}

// --- Lazy-Loader: Fontbytes erst bei Bedarf, mit Memo-Cache -------------------

const bytesCache = new Map<string, Promise<ArrayBuffer>>()

/** Lädt die TTF-Bytes einer gebündelten Font-URL (gecacht). */
export function loadFontBytes(url: string): Promise<ArrayBuffer> {
  let p = bytesCache.get(url)
  if (!p) {
    p = fetch(url).then((r) => {
      if (!r.ok) throw new Error(`Schrift ${url}: HTTP ${r.status}`)
      return r.arrayBuffer()
    })
    bytesCache.set(url, p)
  }
  return p
}

// --- Vorschau: CSS-Font-Stack + FontFace-Registrierung ------------------------

function standardStack(family: string): string {
  if (family === 'Times') return 'Georgia, "Times New Roman", serif'
  if (family === 'Courier') return '"Courier New", monospace'
  return 'Helvetica, Arial, sans-serif'
}

/**
 * Synchroner CSS-`font-family`-Stack für die Vorschau. Nennt zuerst die gebündelte
 * Familie (falls vorhanden) und dahinter einen System-Fallback — der Browser
 * schaltet automatisch um, sobald die FontFace via `ensurePreviewFont` geladen ist.
 */
export function previewFontStack(spec: FontSpec): string {
  const base = FAMILY_FILE[spec.family as BundledFamily]
  if (base) return `"Pdf-${spec.family}", ${standardStack(spec.family)}`
  return standardStack(spec.family)
}

let _measureCtx: CanvasRenderingContext2D | null = null
function measureCtx(): CanvasRenderingContext2D {
  if (!_measureCtx) {
    _measureCtx = document.createElement('canvas').getContext('2d')!
  }
  return _measureCtx
}

/**
 * Abstand der alphabetischen Grundlinie von der Oberkante einer `line-height:1`-Zeile
 * (in px), gemessen mit den *echten* Metriken der (geladenen) Schrift. Damit lässt
 * sich die Vorschau grundlinien-genau positionieren — deckungsgleich mit dem Export,
 * der ebenfalls an der Grundlinie zeichnet. Fällt bei fehlenden Canvas-Metriken auf
 * einen typischen Wert zurück.
 */
export function baselineFromTopPx(spec: FontSpec, sizePx: number): number {
  const c = measureCtx()
  const weight = spec.weight >= 600 ? 700 : 400
  const style = spec.italic ? 'italic ' : ''
  c.font = `${style}${weight} ${sizePx}px ${previewFontStack(spec)}`
  const m = c.measureText('Hg')
  const a = m.fontBoundingBoxAscent
  const d = m.fontBoundingBoxDescent
  if (typeof a === 'number' && typeof d === 'number') {
    // Grundlinie in einer 1em-Zeile: halbe Zeilenschaltung + Ascent.
    return (sizePx + a - d) / 2
  }
  return sizePx * 0.82
}

const registeredFaces = new Set<string>()

/**
 * Registriert die gebündelte Schrift als FontFace (idempotent), damit die Vorschau
 * in genau der Schrift erscheint, die auch der Export einbettet. No-op für
 * Standard-14 (dort greift der System-Stack). Fehler werden geschluckt — die
 * Vorschau fällt dann still auf den System-Fallback zurück.
 */
export async function ensurePreviewFont(spec: FontSpec): Promise<void> {
  const src = fontSource(spec)
  if (src.kind !== 'bundled') return
  const key = `Pdf-${spec.family}-${styleKey(spec.weight, spec.italic)}`
  if (registeredFaces.has(key)) return
  registeredFaces.add(key)
  try {
    const face = new FontFace(`Pdf-${spec.family}`, `url(${src.url})`, {
      weight: spec.weight >= 600 ? '700' : '400',
      style: spec.italic ? 'italic' : 'normal',
    })
    await face.load()
    ;(document as unknown as { fonts: FontFaceSet }).fonts.add(face)
  } catch {
    registeredFaces.delete(key) // erneuter Versuch später möglich
  }
}

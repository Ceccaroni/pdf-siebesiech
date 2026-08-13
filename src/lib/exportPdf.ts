import { PDFDocument, StandardFonts, degrees, rgb, type PDFFont } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import type {
  Annotation,
  FontSpec,
  PageDescriptor,
  SourceDoc,
} from '../engine/types'
import { fontSource, loadFontBytes } from '../engine/fonts'

/** Deckungsrand der Weissfläche über dem Original (in PDF-Punkten). */
const COVER_PAD_PT = 1

/** `FontSpec` (Standard-14) → passender pdf-lib-StandardFonts-Wert. */
function standardEnum(
  std: 'Helvetica' | 'Times' | 'Courier',
  weight: number,
  italic: boolean,
): StandardFonts {
  const bold = weight >= 600
  if (std === 'Times') {
    if (bold && italic) return StandardFonts.TimesRomanBoldItalic
    if (bold) return StandardFonts.TimesRomanBold
    if (italic) return StandardFonts.TimesRomanItalic
    return StandardFonts.TimesRoman
  }
  if (std === 'Courier') {
    if (bold && italic) return StandardFonts.CourierBoldOblique
    if (bold) return StandardFonts.CourierBold
    if (italic) return StandardFonts.CourierOblique
    return StandardFonts.Courier
  }
  if (bold && italic) return StandardFonts.HelveticaBoldOblique
  if (bold) return StandardFonts.HelveticaBold
  if (italic) return StandardFonts.HelveticaOblique
  return StandardFonts.Helvetica
}

/** Einfacher Greedy-Wortumbruch (keine Silbentrennung — passend zu „kein Reflow"). */
function wrapParagraph(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
): string[] {
  if (!(maxWidth > 0)) return [text]
  const words = text.split(' ')
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word
    if (line && font.widthOfTextAtSize(candidate, size) > maxWidth) {
      lines.push(line)
      line = word
    } else {
      line = candidate
    }
  }
  if (line) lines.push(line)
  return lines
}

function hexToRgb(hex: string) {
  const h = hex.replace('#', '')
  const full =
    h.length === 3
      ? h
          .split('')
          .map((c) => c + c)
          .join('')
      : h
  const n = parseInt(full, 16)
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255)
}

/**
 * Baut aus den Seiten-Deskriptoren ein neues PDF: Reihenfolge, Duplikate,
 * Löschungen, Drehungen und Anmerkungen (Weissfläche + Text) werden hier real
 * umgesetzt (pdf-lib, MIT).
 */
export async function assemblePdf(
  pages: PageDescriptor[],
  sources: Map<string, SourceDoc>,
  annotations: Annotation[] = [],
): Promise<Uint8Array> {
  const out = await PDFDocument.create()
  out.setProducer('PDF-Siebesiech')
  out.setCreator('PDF-Siebesiech')
  out.registerFontkit(fontkit) // für Einbettung mitgelieferter Schriften

  const byPage = new Map<string, Annotation[]>()
  for (const a of annotations) {
    const list = byPage.get(a.pageId) ?? []
    list.push(a)
    byPage.set(a.pageId, list)
  }

  // Schriften bei Bedarf einbetten und cachen. Korrekturen tragen eine `FontSpec`
  // (Originalschrift); freie Textfelder haben keine → Helvetica wie bisher.
  const fontCache = new Map<string, PDFFont>()
  async function getFont(spec: FontSpec | undefined): Promise<PDFFont> {
    const src = fontSource(
      spec ?? { family: 'Helvetica', weight: 400, italic: false },
    )
    if (src.kind === 'standard') {
      const name = standardEnum(src.std, src.weight, src.italic)
      let f = fontCache.get(name)
      if (!f) {
        f = await out.embedFont(name)
        fontCache.set(name, f)
      }
      return f
    }
    let f = fontCache.get(src.url)
    if (!f) {
      const bytes = await loadFontBytes(src.url)
      f = await out.embedFont(bytes, { subset: true })
      fontCache.set(src.url, f)
    }
    return f
  }

  const loaded = new Map<string, PDFDocument>()
  async function getSource(docId: string): Promise<PDFDocument> {
    let doc = loaded.get(docId)
    if (!doc) {
      const src = sources.get(docId)
      if (!src) throw new Error(`Quelle ${docId} fehlt`)
      doc = await PDFDocument.load(src.bytes, { ignoreEncryption: true })
      loaded.set(docId, doc)
    }
    return doc
  }

  for (const p of pages) {
    const srcDoc = await getSource(p.docId)
    const [copied] = await out.copyPages(srcDoc, [p.sourceIndex])
    out.addPage(copied)

    // Anmerkungen im *ungedrehten* Seitenraum zeichnen (y-up, Ursprung unten links).
    const anns = byPage.get(p.id)
    if (anns?.length) {
      const { width: W, height: H } = copied.getSize()
      // Weissflächen zuerst (liegen unter dem Text).
      for (const a of anns) {
        if (a.kind !== 'whiteout') continue
        const height = a.nh * H
        copied.drawRectangle({
          x: a.nx * W,
          y: H * (1 - a.ny) - height,
          width: a.nw * W,
          height,
          color: hexToRgb(a.color),
        })
      }
      for (const a of anns) {
        if (a.kind !== 'text') continue
        // Weissfläche über dem Original (nur Korrekturen) — liegt unter dem Text.
        if (a.box) {
          const topY = H * (1 - a.ny)
          copied.drawRectangle({
            x: a.nx * W - COVER_PAD_PT,
            y: topY - a.box.nh * H - COVER_PAD_PT,
            width: a.box.nw * W + COVER_PAD_PT * 2,
            height: a.box.nh * H + COVER_PAD_PT * 2,
            color: hexToRgb(a.box.bg),
          })
        }
        const f = await getFont(a.font)
        const size = a.fontSize
        const lineHeight = a.lineGap != null ? a.lineGap * H : size * 1.15
        // Absatz-Korrekturen (mit Box) an der Box-Breite umbrechen — derselbe
        // Umbruch wie im Editor-Textfeld (natives Wrapping), damit WYSIWYG stimmt.
        const maxWidth = a.box ? a.box.nw * W : Infinity
        const lines = a.text
          .split('\n')
          .flatMap((para) => (a.box ? wrapParagraph(para, f, size, maxWidth) : [para]))
        // Korrektur: exakte Original-Grundlinie. Freies Textfeld: Oberkante→Ascent.
        const firstBaseline =
          a.baseNy != null ? H * (1 - a.baseNy) : H * (1 - a.ny) - size * 0.8
        lines.forEach((line, i) => {
          if (!line) return
          copied.drawText(line, {
            x: a.nx * W,
            y: firstBaseline - i * lineHeight,
            size,
            font: f,
            color: hexToRgb(a.color),
          })
        })
      }
    }

    // Nutzerdrehung zuletzt anwenden (dreht Seiteninhalt inkl. Anmerkungen mit).
    if (p.rotation) {
      const current = copied.getRotation().angle
      copied.setRotation(degrees((current + p.rotation) % 360))
    }
  }

  return out.save({ useObjectStreams: true })
}

/** Löst einen Download der Bytes im Browser aus. */
export function downloadBytes(bytes: Uint8Array, filename: string): void {
  const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.toLowerCase().endsWith('.pdf') ? filename : `${filename}.pdf`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

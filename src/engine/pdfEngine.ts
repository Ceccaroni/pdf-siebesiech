import * as pdfjsLib from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import type { TextRun } from './types'

// pdf.js bringt seinen eigenen Worker mit — Dekodierung läuft dadurch off-thread,
// wichtig für die schwache Schul-Hardware.
pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl

type LoadingTask = ReturnType<typeof pdfjsLib.getDocument>
interface OpenEntry {
  pdf: PDFDocumentProxy
  task: LoadingTask
}

const openDocs = new Map<string, OpenEntry>()

// --- Render-Warteschlange: begrenzt gleichzeitige Renders (schont schwache CPUs) ---
const MAX_CONCURRENT = 3
let activeJobs = 0
const waiting: Array<() => void> = []

function schedule<T>(job: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const run = () => {
      activeJobs++
      job()
        .then(resolve, reject)
        .finally(() => {
          activeJobs--
          const next = waiting.shift()
          if (next) next()
        })
    }
    if (activeJobs < MAX_CONCURRENT) run()
    else waiting.push(run)
  })
}

/** Lädt ein PDF in die Engine. Gibt Seitenzahl zurück. */
export async function openDocument(
  docId: string,
  bytes: Uint8Array,
): Promise<{ pageCount: number }> {
  // Kopie an pdf.js geben — es „detached" den Puffer; das Original brauchen wir
  // unversehrt für den pdf-lib-Export.
  const task = pdfjsLib.getDocument({
    data: new Uint8Array(bytes),
    // Für schwache Geräte konservativ:
    disableAutoFetch: true,
    disableStream: false,
    // Ohne wasmUrl bricht pdf.js' WASM-JBIG2-Decoder still ab (Bild wird
    // ignoriert) — betrifft v.a. Scans von Multifunktionsgeräten (Xerox u.a.),
    // die JBIG2 für den Text-/Strichlayer nutzen. Relativ zur aktuellen Seiten-
    // URL aufgelöst → funktioniert auch im GitHub-Pages-Unterpfad.
    wasmUrl: new URL('wasm/', document.baseURI).href,
  })
  const pdf = await task.promise
  openDocs.set(docId, { pdf, task })
  return { pageCount: pdf.numPages }
}

export async function closeDocument(docId: string): Promise<void> {
  const entry = openDocs.get(docId)
  if (entry) {
    // Vollständige Freigabe inkl. Worker-Transport läuft über den LoadingTask.
    await entry.task.destroy()
    openDocs.delete(docId)
  }
}

export function isOpen(docId: string): boolean {
  return openDocs.has(docId)
}

export interface RenderResult {
  blob: Blob
  width: number
  height: number
}

/**
 * Rendert eine Quellseite in ein PNG-Blob.
 * Genau eine Grösse angeben: entweder `targetWidth` (CSS-px Zielbreite) oder `scale`.
 * `dpr` skaliert für scharfe Darstellung, wird aber gedeckelt (Speicher).
 */
export async function renderPage(
  docId: string,
  sourceIndex: number,
  opts: {
    targetWidth?: number
    scale?: number
    rotationDelta?: number
    dpr?: number
  },
): Promise<RenderResult> {
  return schedule(async () => {
    const entry = openDocs.get(docId)
    if (!entry) throw new Error(`Dokument ${docId} ist nicht geladen`)

    const page = await entry.pdf.getPage(sourceIndex + 1)
    try {
      const rotation = (((page.rotate + (opts.rotationDelta ?? 0)) % 360) + 360) % 360
      const dpr = Math.min(opts.dpr ?? 1, 2)

      let scale = opts.scale ?? 1
      if (opts.targetWidth) {
        const base = page.getViewport({ scale: 1, rotation })
        scale = opts.targetWidth / base.width
      }
      const viewport = page.getViewport({ scale: scale * dpr, rotation })

      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.ceil(viewport.width))
      canvas.height = Math.max(1, Math.ceil(viewport.height))

      // pdf.js v6: `canvas` übergeben — die Engine holt sich den Context selbst
      // und füllt den Seitenhintergrund korrekt (weiss) für opake Seiten.
      await page.render({ canvas, viewport }).promise

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error('toBlob fehlgeschlagen'))),
          'image/png',
        )
      })
      // Canvas freigeben (Speicher auf schwacher Hardware).
      canvas.width = 0
      canvas.height = 0
      return { blob, width: viewport.width, height: viewport.height }
    } finally {
      page.cleanup()
    }
  })
}

/**
 * Rendert eine Seite als PNG-Blob für den Editor und liefert zusätzlich CSS-Masse
 * und den Punkt→CSS-px-Faktor (`scale`) fürs Overlay. Nutzt (wie Thumbnails) ein
 * *frisches* Canvas pro Aufruf — robust gegen doppelte/rasche Renders.
 */
export async function renderPageImage(
  docId: string,
  sourceIndex: number,
  opts: { targetWidth: number; rotationDelta?: number; dpr?: number },
): Promise<{ blob: Blob; width: number; height: number; scale: number }> {
  return schedule(async () => {
    const entry = openDocs.get(docId)
    if (!entry) throw new Error(`Dokument ${docId} ist nicht geladen`)
    const page = await entry.pdf.getPage(sourceIndex + 1)
    try {
      const rotation =
        (((page.rotate + (opts.rotationDelta ?? 0)) % 360) + 360) % 360
      const dpr = Math.min(opts.dpr ?? 1, 2)
      const base = page.getViewport({ scale: 1, rotation })
      const cssScale = opts.targetWidth / base.width
      const viewport = page.getViewport({ scale: cssScale * dpr, rotation })
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.ceil(viewport.width))
      canvas.height = Math.max(1, Math.ceil(viewport.height))
      await page.render({ canvas, viewport }).promise
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error('toBlob fehlgeschlagen'))),
          'image/png',
        )
      })
      canvas.width = 0
      canvas.height = 0
      return {
        blob,
        width: viewport.width / dpr,
        height: viewport.height / dpr,
        scale: cssScale,
      }
    } finally {
      page.cleanup()
    }
  })
}

/** Liefert die intrinsische Grösse (in PDF-Punkten) inkl. Nutzerdrehung. */
export async function getPageSize(
  docId: string,
  sourceIndex: number,
  rotationDelta = 0,
): Promise<{ width: number; height: number }> {
  const entry = openDocs.get(docId)
  if (!entry) throw new Error(`Dokument ${docId} ist nicht geladen`)
  const page = await entry.pdf.getPage(sourceIndex + 1)
  const rotation = (((page.rotate + rotationDelta) % 360) + 360) % 360
  const vp = page.getViewport({ scale: 1, rotation })
  page.cleanup()
  return { width: vp.width, height: vp.height }
}

/**
 * Liest die Textläufe einer Quellseite aus (pdf.js `getTextContent`) im *ungedrehten*
 * User-Space und normalisiert sie auf 0..1 (ab oben links) — exakt der Raum, in dem
 * der pdf-lib-Export zeichnet. Rohmaterial fürs Werkzeug „Text korrigieren".
 *
 * Vorher wird `getOperatorList()` aufgerufen: nur dann sind die *realen* Fontnamen
 * über `commonObjs` abrufbar. Das `styles`-Dict von pdf.js liefert bloss generische
 * Familien wie "sans-serif" und taugt nicht zum Schrift-Matching.
 */
export async function getPageTextRuns(
  docId: string,
  sourceIndex: number,
): Promise<TextRun[]> {
  const entry = openDocs.get(docId)
  if (!entry) throw new Error(`Dokument ${docId} ist nicht geladen`)
  const page = await entry.pdf.getPage(sourceIndex + 1)
  try {
    const vp = page.getViewport({ scale: 1, rotation: 0 })
    const W = vp.width
    const H = vp.height

    // Fonts laden → reale Namen (commonObjs) verfügbar.
    await page.getOperatorList()
    const tc = await page.getTextContent()

    const commonObjs = page.commonObjs as unknown as {
      has(id: string): boolean
      get(id: string): { name?: string; loadedName?: string } | null
    }
    const nameCache = new Map<string, string>()
    const resolveName = (fontName: string): string => {
      const cached = nameCache.get(fontName)
      if (cached !== undefined) return cached
      let name = fontName
      try {
        if (commonObjs.has(fontName)) {
          const f = commonObjs.get(fontName)
          name = f?.name || f?.loadedName || fontName
        }
      } catch {
        /* fällt auf den internen Key zurück */
      }
      nameCache.set(fontName, name)
      return name
    }

    const runs: TextRun[] = []
    for (const raw of tc.items) {
      if (!('str' in raw)) continue // TextMarkedContent überspringen
      const it = raw as {
        str: string
        transform: number[]
        width: number
        fontName: string
      }
      if (it.str.trim() === '') continue
      const t = it.transform
      const fontSize = Math.hypot(t[0], t[1])
      if (fontSize <= 0) continue
      const style = tc.styles[it.fontName] as
        | { ascent?: number; descent?: number }
        | undefined
      const asc = style?.ascent ?? 0.9
      const desc = style?.descent ?? -0.24 // negativ
      const baseNy = 1 - t[5] / H
      runs.push({
        text: it.str,
        nx: t[4] / W,
        ny: baseNy - (asc * fontSize) / H,
        nw: it.width / W,
        nh: ((asc - desc) * fontSize) / H,
        baseNy,
        fontSize,
        fontName: resolveName(it.fontName),
      })
    }
    return runs
  } finally {
    page.cleanup()
  }
}

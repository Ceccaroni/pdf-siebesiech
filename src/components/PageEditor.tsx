import { useEffect, useMemo, useRef, useState } from 'react'
import type React from 'react'
import type { Dispatch } from 'react'
import { GripVertical, RotateCcw, Loader2, WandSparkles } from 'lucide-react'
import type {
  PageDescriptor,
  RectAnnotation,
  TextAnnotation,
  TextRun,
  Tool,
} from '../engine/types'
import { getPageTextRuns, renderPageImage } from '../engine/pdfEngine'
import { groupTextRunsIntoBlocks, type TextBlock } from '../engine/textBlocks'
import {
  baselineFromTopPx,
  ensurePreviewFont,
  matchFontName,
  previewFontStack,
} from '../engine/fonts'
import { useStore, type Action } from '../state/store'
import { EditorToolbar } from './EditorToolbar'
import { cn, newId } from '../lib/utils'

/** Kleiner Deckungsrand (px), damit die Weissfläche das Original sicher abdeckt. */
const COVER_PAD_PX = 2

function toHex(n: number): string {
  return Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')
}

/**
 * Tastet die echte Hintergrundfarbe unter einem Textlauf ab: zeichnet die
 * gerenderte Seite in ein Canvas und nimmt den Median je Farbkanal über die
 * Lauf-Fläche. Der dunkle Text ist dort in der Minderheit → der Median trifft
 * den Hintergrund (auch bei zartem Farbverlauf). Fällt auf Weiss zurück.
 */
async function sampleBackground(
  imgUrl: string,
  rect: { nx: number; ny: number; nw: number; nh: number },
): Promise<string> {
  const img = new Image()
  img.src = imgUrl
  await img.decode()
  const W = img.naturalWidth
  const H = img.naturalHeight
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return '#ffffff'
  ctx.drawImage(img, 0, 0)
  const x0 = Math.max(0, Math.floor(rect.nx * W))
  const y0 = Math.max(0, Math.floor(rect.ny * H))
  const w = Math.max(1, Math.min(W - x0, Math.ceil(rect.nw * W)))
  const h = Math.max(1, Math.min(H - y0, Math.ceil(rect.nh * H)))
  const { data } = ctx.getImageData(x0, y0, w, h)
  const rs: number[] = []
  const gs: number[] = []
  const bs: number[] = []
  for (let i = 0; i < data.length; i += 4) {
    rs.push(data[i])
    gs.push(data[i + 1])
    bs.push(data[i + 2])
  }
  const median = (arr: number[]) => {
    arr.sort((a, b) => a - b)
    return arr[arr.length >> 1]
  }
  // Canvas freigeben (schwache Hardware).
  canvas.width = 0
  canvas.height = 0
  return `#${toHex(median(rs))}${toHex(median(gs))}${toHex(median(bs))}`
}

const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v))
const clamp01 = (v: number) => clamp(v, 0, 1)

/** Startet eine Zeiger-Ziehgeste; meldet Deltas (in CSS-px) relativ zum Start. */
function beginDrag(
  e: React.PointerEvent,
  onMove: (dx: number, dy: number) => void,
  onEnd?: () => void,
) {
  e.preventDefault()
  e.stopPropagation()
  const sx = e.clientX
  const sy = e.clientY
  const move = (ev: PointerEvent) => onMove(ev.clientX - sx, ev.clientY - sy)
  const up = () => {
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', up)
    onEnd?.()
  }
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', up)
}

interface Size {
  w: number
  h: number
  scale: number
}

export function PageEditor({
  page,
  number,
  total,
  zoom,
}: {
  page: PageDescriptor
  number: number
  total: number
  zoom: number
}) {
  const { state, dispatch } = useStore()
  const { tool, annotations, selectedAnnotationId } = state
  const editable = page.rotation === 0

  const containerRef = useRef<HTMLDivElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const draftRef = useRef<RectDraft | null>(null)
  const urlRef = useRef<string | null>(null)

  const [containerWidth, setContainerWidth] = useState(0)
  const [size, setSize] = useState<Size>({ w: 0, h: 0, scale: 1 })
  const [url, setUrl] = useState<string | null>(null)
  const [draft, setDraft] = useState<RectDraft | null>(null)
  const [autoFocusId, setAutoFocusId] = useState<string | null>(null)
  // Textläufe aus dem Quell-PDF (fürs Werkzeug „Text korrigieren"), lazy geladen.
  const [runs, setRuns] = useState<TextRun[] | null>(null)
  const [runsStatus, setRunsStatus] = useState<
    'idle' | 'loading' | 'ready' | 'empty' | 'error'
  >('idle')

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) =>
      setContainerWidth(entries[0].contentRect.width),
    )
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const renderWidth = Math.round(clamp(containerWidth - 80, 280, 1300) * zoom)

  useEffect(() => {
    if (renderWidth <= 0) return
    let cancelled = false
    renderPageImage(page.docId, page.sourceIndex, {
      targetWidth: renderWidth,
      rotationDelta: page.rotation,
      dpr: window.devicePixelRatio,
    })
      .then(({ blob, width, height, scale }) => {
        if (cancelled) return
        const next = URL.createObjectURL(blob)
        if (urlRef.current) URL.revokeObjectURL(urlRef.current)
        urlRef.current = next
        setUrl(next)
        setSize({ w: width, h: height, scale })
      })
      .catch((e) => console.error('Seiten-Render fehlgeschlagen:', e))
    return () => {
      cancelled = true
    }
  }, [page.id, page.docId, page.sourceIndex, page.rotation, renderWidth])

  // Object-URL beim Verlassen freigeben.
  useEffect(() => {
    return () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    }
  }, [])

  // Textläufe zurücksetzen, sobald sich die Seite ändert.
  useEffect(() => {
    setRuns(null)
    setRunsStatus('idle')
  }, [page.id])

  // Im Modus „Text korrigieren" die Textläufe der Seite einmalig laden.
  useEffect(() => {
    if (tool !== 'redigieren' || !editable || runs !== null) return
    let cancelled = false
    setRunsStatus('loading')
    getPageTextRuns(page.docId, page.sourceIndex)
      .then((r) => {
        if (cancelled) return
        setRuns(r)
        setRunsStatus(r.length ? 'ready' : 'empty')
      })
      .catch((e) => {
        if (cancelled) return
        console.error('Textextraktion fehlgeschlagen:', e)
        setRunsStatus('error')
      })
    return () => {
      cancelled = true
    }
  }, [tool, editable, runs, page.docId, page.sourceIndex])

  const pageAnnotations = annotations.filter((a) => a.pageId === page.id)

  // Textläufe zu Absätzen gruppieren (gleicher Rand/Schrift/Zeilenabstand) —
  // damit sich ein ganzer Absatz statt nur einer Einzelzeile korrigieren lässt.
  const blocks = useMemo(
    () => (runs ? groupTextRunsIntoBlocks(runs) : null),
    [runs],
  )

  /** Erzeugt aus einem erkannten Absatz eine Korrektur: Weissfläche (in der
   *  echten Hintergrundfarbe) + neu setzbares, mehrzeiliges Textfeld in der
   *  gematchten Originalschrift, an exakt der Original-Grundlinie. */
  async function createCorrection(block: TextBlock) {
    const font = matchFontName(block.fontName)
    void ensurePreviewFont(font) // Vorschau-Schrift im Hintergrund laden
    let bg = '#ffffff'
    if (url) {
      try {
        bg = await sampleBackground(url, block)
      } catch (e) {
        console.error('Hintergrund-Abtastung fehlgeschlagen:', e)
      }
    }
    const ann: TextAnnotation = {
      id: newId(),
      kind: 'text',
      pageId: page.id,
      nx: block.nx,
      ny: block.ny,
      fontSize: block.fontSize,
      color: '#000000',
      text: block.text,
      origin: block.text,
      baseNy: block.baseNy,
      lineGap: block.lineGap,
      font,
      box: { nw: block.nw, nh: block.nh, bg },
    }
    setAutoFocusId(ann.id)
    dispatch({ type: 'ADD_ANNOTATION', annotation: ann })
    dispatch({ type: 'SET_TOOL', tool: 'select' })
  }

  function onOverlayPointerDown(e: React.PointerEvent) {
    if (e.target !== overlayRef.current || !editable) return
    const rect = overlayRef.current.getBoundingClientRect()
    const nx = clamp01((e.clientX - rect.left) / rect.width)
    const ny = clamp01((e.clientY - rect.top) / rect.height)

    if (tool === 'text') {
      const ann: TextAnnotation = {
        id: newId(),
        kind: 'text',
        pageId: page.id,
        nx,
        ny,
        fontSize: 16,
        color: '#1a1a1a',
        text: '',
      }
      setAutoFocusId(ann.id)
      dispatch({ type: 'ADD_ANNOTATION', annotation: ann })
      dispatch({ type: 'SET_TOOL', tool: 'select' })
    } else if (tool === 'whiteout') {
      const startNx = nx
      const startNy = ny
      const rw = rect.width
      const rh = rect.height
      const update = (dx: number, dy: number) => {
        const w = dx / rw
        const h = dy / rh
        const d: RectDraft = {
          nx: Math.min(startNx, startNx + w),
          ny: Math.min(startNy, startNy + h),
          nw: Math.abs(w),
          nh: Math.abs(h),
        }
        draftRef.current = d
        setDraft(d)
      }
      update(0, 0)
      beginDrag(e, update, () => {
        const d = draftRef.current
        draftRef.current = null
        setDraft(null)
        if (d && d.nw > 0.006 && d.nh > 0.006) {
          const ann: RectAnnotation = {
            id: newId(),
            kind: 'whiteout',
            pageId: page.id,
            ...d,
            color: '#ffffff',
          }
          dispatch({ type: 'ADD_ANNOTATION', annotation: ann })
        }
        dispatch({ type: 'SET_TOOL', tool: 'select' })
      })
    } else {
      dispatch({ type: 'SELECT_ANNOTATION', id: null })
    }
  }

  const cursor =
    tool === 'text' ? 'text' : tool === 'whiteout' ? 'crosshair' : 'default'

  return (
    <div
      ref={containerRef}
      className="relative flex h-full flex-1 flex-col overflow-auto bg-ink-200/60"
    >
      <div className="pointer-events-none sticky top-0 z-20 flex justify-center p-3">
        <EditorToolbar disabled={!editable} />
      </div>

      <div className="flex flex-1 justify-center px-10 pb-16">
        <div
          className="relative my-auto"
          style={{ width: size.w || undefined }}
        >
          {url ? (
            <img
              src={url}
              alt={`Seite ${number}`}
              draggable={false}
              className="block select-none rounded-sm bg-white shadow-page"
              style={{ width: size.w || undefined, height: size.h || undefined }}
            />
          ) : (
            <div
              className="animate-pulse rounded-sm bg-white shadow-page"
              style={{
                width: renderWidth,
                height: Math.round(renderWidth * 1.414),
              }}
            />
          )}

          {editable && size.w > 0 && (
            <div
              ref={overlayRef}
              className="absolute inset-0"
              style={{ width: size.w, height: size.h, cursor }}
              onPointerDown={onOverlayPointerDown}
            >
              {pageAnnotations.map((a) =>
                a.kind === 'text' ? (
                  <TextAnnotationView
                    key={a.id}
                    ann={a}
                    cssW={size.w}
                    cssH={size.h}
                    scale={size.scale}
                    tool={tool}
                    selected={a.id === selectedAnnotationId}
                    autoFocus={a.id === autoFocusId}
                    dispatch={dispatch}
                  />
                ) : (
                  <WhiteoutAnnotationView
                    key={a.id}
                    ann={a}
                    cssW={size.w}
                    cssH={size.h}
                    tool={tool}
                    selected={a.id === selectedAnnotationId}
                    dispatch={dispatch}
                  />
                ),
              )}

              {draft && (
                <div
                  className="pointer-events-none absolute border border-dashed border-brand-500 bg-white/70"
                  style={{
                    left: draft.nx * size.w,
                    top: draft.ny * size.h,
                    width: draft.nw * size.w,
                    height: draft.nh * size.h,
                  }}
                />
              )}

              {/* „Text korrigieren": erkannte Absätze als anklickbare Hotspots. */}
              {tool === 'redigieren' &&
                blocks?.map((block, i) => (
                  <button
                    key={i}
                    type="button"
                    title="Diesen Absatz korrigieren"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation()
                      createCorrection(block)
                    }}
                    className="absolute cursor-pointer rounded-[2px] border border-brand-400/40 bg-brand-400/5 transition-colors hover:border-brand-500 hover:bg-brand-400/25"
                    style={{
                      left: block.nx * size.w - COVER_PAD_PX,
                      top: block.ny * size.h - COVER_PAD_PX,
                      width: block.nw * size.w + COVER_PAD_PX * 2,
                      height: block.nh * size.h + COVER_PAD_PX * 2,
                    }}
                  />
                ))}
            </div>
          )}

          {!editable && (
            <div className="absolute left-1/2 top-3 -translate-x-1/2 rounded-lg bg-ink-950/85 px-3 py-1.5 text-xs text-white shadow-md">
              <RotateCcw size={13} className="mr-1 inline align-[-2px]" />
              Zum Bearbeiten Seite auf 0° drehen
            </div>
          )}

          {editable && tool === 'redigieren' && (
            <div className="pointer-events-none absolute left-1/2 top-3 flex -translate-x-1/2 items-center gap-1.5 rounded-lg bg-ink-950/85 px-3 py-1.5 text-xs text-white shadow-md">
              {(runsStatus === 'loading' || runsStatus === 'idle') && (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  Text wird analysiert …
                </>
              )}
              {runsStatus === 'ready' && (
                <>
                  <WandSparkles size={13} />
                  Absatz antippen zum Korrigieren
                </>
              )}
              {runsStatus === 'empty' &&
                'Kein bearbeitbarer Text auf dieser Seite (evtl. gescannt)'}
              {runsStatus === 'error' && 'Text konnte nicht gelesen werden'}
            </div>
          )}
        </div>
      </div>

      <div className="pointer-events-none sticky bottom-4 left-1/2 z-10 mx-auto w-fit rounded-full bg-ink-950/80 px-3 py-1 text-xs font-medium text-white shadow-md backdrop-blur">
        Seite {number} / {total}
      </div>
    </div>
  )
}

interface RectDraft {
  nx: number
  ny: number
  nw: number
  nh: number
}

function TextAnnotationView({
  ann,
  cssW,
  cssH,
  scale,
  tool,
  selected,
  autoFocus,
  dispatch,
}: {
  ann: TextAnnotation
  cssW: number
  cssH: number
  scale: number
  tool: Tool
  selected: boolean
  autoFocus: boolean
  dispatch: Dispatch<Action>
}) {
  const editRef = useRef<HTMLDivElement>(null)
  const taRef = useRef<HTMLTextAreaElement>(null)
  const editable = tool === 'select'
  const [fontReady, setFontReady] = useState(false)
  const isCorr = !!ann.box

  // Freitext: Inhalt nur beim Mounten aus dem State setzen (danach steuert der
  // Nutzer das DOM). Korrekturen laufen über ein kontrolliertes <textarea>.
  useEffect(() => {
    if (!isCorr && editRef.current && editRef.current.textContent !== ann.text) {
      editRef.current.textContent = ann.text
    }
    // Vorschau-Schrift laden; danach Neumessung der Grundlinie auslösen.
    if (ann.font) {
      ensurePreviewFont(ann.font)
        .then(() => setFontReady(true))
        .catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!autoFocus) return
    if (isCorr && taRef.current) {
      taRef.current.focus()
      const len = taRef.current.value.length
      taRef.current.setSelectionRange(len, len)
    } else if (!isCorr && editRef.current) {
      editRef.current.focus()
      const r = document.createRange()
      r.selectNodeContents(editRef.current)
      r.collapse(false)
      const sel = window.getSelection()
      sel?.removeAllRanges()
      sel?.addRange(r)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFocus])

  // Textarea-Höhe an den Inhalt anpassen (kein natives Auto-Grow bei <textarea>).
  useEffect(() => {
    if (isCorr && taRef.current) {
      taRef.current.style.height = '0px'
      taRef.current.style.height = `${taRef.current.scrollHeight}px`
    }
  }, [isCorr, ann.text, fontReady])

  const fontSizePx = ann.fontSize * scale
  const fontFamily = ann.font
    ? previewFontStack(ann.font)
    : 'Helvetica, Arial, sans-serif'

  // Grundlinien-genaue Vorschau: Bei Korrekturen sitzt der Container auf der
  // Original-Grundlinie und der Text wird um seinen *gemessenen* Ascent nach oben
  // versetzt — deckungsgleich mit dem Export. `fontReady` triggert die Neumessung,
  // sobald die Originalschrift geladen ist. Freie Textfelder bleiben wie bisher.
  const containerTop =
    isCorr && ann.baseNy != null ? ann.baseNy * cssH : ann.ny * cssH
  const textTop = useMemo(
    () => (isCorr && ann.font ? -baselineFromTopPx(ann.font, fontSizePx) : 0),
    // fontReady ist bewusst dabei: erzwingt die Neumessung nach dem Font-Laden.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isCorr, ann.font, fontSizePx, fontReady],
  )
  // Absätze (≥2 Original-Zeilen) nutzen ihren echten Grundlinienabstand;
  // eine einzelne Korrekturzeile bleibt beim bisherigen, engen Wert (1×
  // Schriftgrösse) — exakt das bereits kalibrierte Verhalten, unverändert.
  const lineHeight: number | string =
    ann.lineGap != null ? `${ann.lineGap * cssH}px` : 1

  return (
    <div
      className={cn('absolute', !editable && 'pointer-events-none')}
      style={{ left: ann.nx * cssW, top: containerTop }}
      onPointerDown={(e) => {
        e.stopPropagation()
        dispatch({ type: 'SELECT_ANNOTATION', id: ann.id })
      }}
    >
      {/* Weissfläche (echte Hintergrundfarbe) über dem Original — hinter dem Text. */}
      {ann.box && (
        <div
          className="pointer-events-none absolute"
          style={{
            left: -COVER_PAD_PX,
            top: (ann.ny - (ann.baseNy ?? ann.ny)) * cssH - COVER_PAD_PX,
            width: ann.box.nw * cssW + COVER_PAD_PX * 2,
            height: ann.box.nh * cssH + COVER_PAD_PX * 2,
            backgroundColor: ann.box.bg,
          }}
        />
      )}

      {selected && editable && (
        <div
          title="Verschieben"
          onPointerDown={(e) => {
            const sx = ann.nx
            const sy = ann.ny
            const sb = ann.baseNy
            beginDrag(e, (dx, dy) => {
              const nx = clamp01(sx + dx / cssW)
              const ny = clamp01(sy + dy / cssH)
              dispatch({
                type: 'UPDATE_ANNOTATION',
                id: ann.id,
                // Korrektur: Grundlinie mitführen, damit Text + Weissfläche zusammenbleiben.
                patch:
                  sb != null
                    ? { nx, ny, baseNy: clamp01(sb + dy / cssH) }
                    : { nx, ny },
              })
            })
          }}
          className="absolute -top-[18px] left-0 flex h-4 cursor-move items-center rounded bg-brand-600 px-1 text-white"
        >
          <GripVertical size={11} />
        </div>
      )}

      {selected && ann.font?.approx && (
        <div
          className="pointer-events-none absolute left-0 top-2 flex items-center gap-1 whitespace-nowrap rounded bg-amber-500/95 px-1.5 py-0.5 text-[10px] font-medium text-white shadow"
          title="Die Originalschrift ist nicht verfügbar — es wird eine ähnliche verwendet."
        >
          <WandSparkles size={10} />
          Schrift angenähert
        </div>
      )}

      {ann.box ? (
        // Korrektur (einzeilig oder ganzer Absatz): <textarea> — nativ mehrzeilig
        // und wrappt an der Box-Breite, exakt wie der Export (wrapParagraph).
        <textarea
          ref={taRef}
          value={ann.text}
          readOnly={!editable}
          spellCheck={false}
          onChange={(e) =>
            dispatch({
              type: 'UPDATE_ANNOTATION',
              id: ann.id,
              patch: { text: e.target.value },
            })
          }
          onBlur={(e) => {
            if (!e.target.value.trim()) {
              dispatch({ type: 'DELETE_ANNOTATION', id: ann.id })
            }
          }}
          style={{
            position: 'absolute',
            left: 0,
            top: textTop,
            width: ann.box.nw * cssW,
            fontSize: fontSizePx,
            color: ann.color,
            lineHeight,
            fontFamily,
            fontWeight: ann.font && ann.font.weight >= 600 ? 700 : 400,
            fontStyle: ann.font?.italic ? 'italic' : 'normal',
            resize: 'none',
            overflow: 'hidden',
            border: 'none',
            outline: 'none',
            background: 'transparent',
            padding: 0,
            margin: 0,
          }}
          className={cn(
            'block cursor-text',
            selected && 'rounded-[3px] ring-2 ring-brand-400/70',
          )}
        />
      ) : (
        <div
          ref={editRef}
          contentEditable={editable}
          suppressContentEditableWarning
          spellCheck={false}
          onInput={(e) =>
            dispatch({
              type: 'UPDATE_ANNOTATION',
              id: ann.id,
              patch: { text: e.currentTarget.textContent ?? '' },
            })
          }
          onBlur={(e) => {
            if (!(e.currentTarget.textContent ?? '').trim()) {
              dispatch({ type: 'DELETE_ANNOTATION', id: ann.id })
            }
          }}
          style={{
            position: 'absolute',
            left: 0,
            top: textTop,
            fontSize: fontSizePx,
            color: ann.color,
            lineHeight: 1.15,
            whiteSpace: 'pre',
            fontFamily,
            fontWeight: ann.font && ann.font.weight >= 600 ? 700 : 400,
            fontStyle: ann.font?.italic ? 'italic' : 'normal',
          }}
          className={cn(
            'min-w-[6px] cursor-text px-[1px] outline-none',
            selected && 'rounded-[3px] ring-2 ring-brand-400/70',
          )}
        />
      )}
    </div>
  )
}

function WhiteoutAnnotationView({
  ann,
  cssW,
  cssH,
  tool,
  selected,
  dispatch,
}: {
  ann: RectAnnotation
  cssW: number
  cssH: number
  tool: Tool
  selected: boolean
  dispatch: Dispatch<Action>
}) {
  const editable = tool === 'select'
  return (
    <div
      className={cn(
        'absolute',
        editable ? 'cursor-move' : 'pointer-events-none',
        selected && 'ring-2 ring-brand-500',
      )}
      style={{
        left: ann.nx * cssW,
        top: ann.ny * cssH,
        width: ann.nw * cssW,
        height: ann.nh * cssH,
        backgroundColor: ann.color,
        outline: '1px dashed rgba(219,47,36,0.35)',
        outlineOffset: '-1px',
      }}
      onPointerDown={(e) => {
        e.stopPropagation()
        dispatch({ type: 'SELECT_ANNOTATION', id: ann.id })
        if (editable) {
          const sx = ann.nx
          const sy = ann.ny
          beginDrag(e, (dx, dy) =>
            dispatch({
              type: 'UPDATE_ANNOTATION',
              id: ann.id,
              patch: {
                nx: clamp01(sx + dx / cssW),
                ny: clamp01(sy + dy / cssH),
              },
            }),
          )
        }
      }}
    >
      {selected && editable && (
        <div
          onPointerDown={(e) => {
            const sw = ann.nw
            const sh = ann.nh
            beginDrag(e, (dx, dy) =>
              dispatch({
                type: 'UPDATE_ANNOTATION',
                id: ann.id,
                patch: {
                  nw: Math.max(0.01, sw + dx / cssW),
                  nh: Math.max(0.01, sh + dy / cssH),
                },
              }),
            )
          }}
          className="absolute -bottom-1.5 -right-1.5 h-3 w-3 cursor-nwse-resize rounded-full border-2 border-white bg-brand-500"
        />
      )}
    </div>
  )
}

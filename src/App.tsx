import { useCallback, useEffect, useMemo, useState } from 'react'
import { X } from 'lucide-react'
import { TopBar } from './components/TopBar'
import { ThumbnailSidebar } from './components/ThumbnailSidebar'
import { PageEditor } from './components/PageEditor'
import { EmptyState } from './components/EmptyState'
import { DropOverlay } from './components/DropOverlay'
import { useStore } from './state/store'
import { importFiles } from './state/importFiles'
import { useFileDrop } from './hooks/useFileDrop'
import { assemblePdf, downloadBytes } from './lib/exportPdf'

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

export default function App() {
  const { state, dispatch } = useStore()
  const { pages, sources, activeId, annotations, selectedIds } = state

  const [zoom, setZoom] = useState(1)
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState<string[]>([])

  const handleFiles = useCallback(
    async (files: FileList) => {
      const { errors } = await importFiles(files, dispatch)
      if (errors.length) setErrors(errors)
    },
    [dispatch],
  )

  const isDragging = useFileDrop(handleFiles)

  // Fehlermeldungen nach kurzer Zeit ausblenden.
  useEffect(() => {
    if (!errors.length) return
    const t = setTimeout(() => setErrors([]), 6000)
    return () => clearTimeout(t)
  }, [errors])

  // Escape: aktive Anmerkung abwählen und zurück zum Auswahl-Werkzeug.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      const el = document.activeElement as HTMLElement | null
      if (el?.isContentEditable) el.blur()
      dispatch({ type: 'SELECT_ANNOTATION', id: null })
      dispatch({ type: 'SET_TOOL', tool: 'select' })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [dispatch])

  const activePage = useMemo(
    () => pages.find((p) => p.id === activeId) ?? pages[0] ?? null,
    [pages, activeId],
  )
  const activeNumber = activePage
    ? pages.findIndex((p) => p.id === activePage.id) + 1
    : 0

  const docName = useMemo(() => {
    const docIds = new Set(pages.map((p) => p.docId))
    if (docIds.size === 1) {
      const only = pages[0]
      return only ? (sources[only.docId]?.name ?? null) : null
    }
    if (docIds.size > 1) return `${docIds.size} Dokumente`
    return null
  }, [pages, sources])

  const runExport = useCallback(
    async (scope: 'all' | 'selection') => {
      const subset =
        scope === 'selection'
          ? pages.filter((p) => selectedIds.includes(p.id))
          : pages
      if (!subset.length) return
      setBusy(true)
      try {
        const sourcesMap = new Map(Object.entries(sources))
        const bytes = await assemblePdf(subset, sourcesMap, annotations)
        const base =
          docName && docName.toLowerCase().endsWith('.pdf')
            ? docName.slice(0, -4)
            : (docName ?? 'dokument')
        const suffix =
          scope === 'selection'
            ? `-auswahl-${subset.length}-seiten`
            : '-bearbeitet'
        downloadBytes(bytes, `${base}${suffix}.pdf`)
      } catch (err) {
        setErrors([
          `Export fehlgeschlagen${err instanceof Error ? `: ${err.message}` : ''}.`,
        ])
      } finally {
        setBusy(false)
      }
    },
    [pages, sources, annotations, docName, selectedIds],
  )

  const hasPages = pages.length > 0

  return (
    <div className="flex h-screen flex-col">
      <TopBar
        docName={docName}
        pageCount={pages.length}
        selectedCount={selectedIds.length}
        canExport={hasPages}
        busy={busy}
        zoom={zoom}
        onZoom={(d) => setZoom((z) => clamp(z + d, 0.25, 4))}
        onResetZoom={() => setZoom(1)}
        onOpenFiles={handleFiles}
        onExport={runExport}
      />

      <div className="flex min-h-0 flex-1">
        {hasPages ? (
          <>
            <ThumbnailSidebar />
            {activePage ? (
              <PageEditor
                page={activePage}
                number={activeNumber}
                total={pages.length}
                zoom={zoom}
              />
            ) : null}
          </>
        ) : (
          <EmptyState onOpenFiles={handleFiles} />
        )}
      </div>

      {isDragging && <DropOverlay />}

      {/* Fehler-Toast */}
      {errors.length > 0 && (
        <div className="fixed bottom-4 left-4 z-40 max-w-sm animate-fade-in space-y-1 rounded-xl border border-brand-200 bg-white p-3 pr-9 text-sm text-ink-700 shadow-panel">
          <button
            type="button"
            onClick={() => setErrors([])}
            className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-md text-ink-400 hover:bg-ink-100"
            aria-label="Schliessen"
          >
            <X size={15} />
          </button>
          {errors.map((e, i) => (
            <div key={i}>{e}</div>
          ))}
        </div>
      )}
    </div>
  )
}

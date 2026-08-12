import { useEffect, useRef, useState } from 'react'
import type React from 'react'
import {
  FilePlus2,
  Download,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Loader2,
  ChevronDown,
  Scissors,
  Info,
} from 'lucide-react'
import { Logo } from './Logo'
import { AboutDialog } from './AboutDialog'
import { cn, truncateMiddle } from '../lib/utils'

export type ExportScope = 'all' | 'selection'

export function TopBar({
  docName,
  pageCount,
  selectedCount,
  canExport,
  busy,
  zoom,
  onZoom,
  onResetZoom,
  onOpenFiles,
  onExport,
}: {
  docName: string | null
  pageCount: number
  selectedCount: number
  canExport: boolean
  busy: boolean
  zoom: number
  onZoom: (delta: number) => void
  onResetZoom: () => void
  onOpenFiles: (files: FileList) => void
  onExport: (scope: ExportScope) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [aboutOpen, setAboutOpen] = useState(false)

  return (
    <>
      <header className="relative z-30 flex h-14 shrink-0 items-center justify-between gap-4 border-b border-ink-200 bg-white/90 px-3 backdrop-blur">
      <div className="flex min-w-0 items-center gap-3">
        <Logo size={30} />
        {docName && (
          <>
            <span className="h-5 w-px bg-ink-200" />
            <div className="min-w-0 truncate text-[13px] text-ink-600">
              <span className="font-medium text-ink-800">
                {truncateMiddle(docName, 32)}
              </span>
              <span className="ml-1.5 text-ink-400">· {pageCount} Seiten</span>
            </div>
          </>
        )}
      </div>

      <div className="flex items-center gap-2">
        {canExport && (
          <div className="mr-1 flex items-center gap-0.5 rounded-lg bg-ink-100 p-0.5">
            <ToolbarIcon title="Verkleinern" onClick={() => onZoom(-0.15)}>
              <ZoomOut size={16} />
            </ToolbarIcon>
            <button
              type="button"
              onClick={onResetZoom}
              className="min-w-12 rounded-md px-1.5 py-1 text-xs font-medium tabular-nums text-ink-600 hover:bg-white"
              title="Zoom zurücksetzen"
            >
              {Math.round(zoom * 100)}%
            </button>
            <ToolbarIcon title="Vergrössern" onClick={() => onZoom(0.15)}>
              <ZoomIn size={16} />
            </ToolbarIcon>
            <ToolbarIcon title="Einpassen" onClick={onResetZoom}>
              <Maximize2 size={16} />
            </ToolbarIcon>
          </div>
        )}

        <button
          type="button"
          onClick={() => setAboutOpen(true)}
          title="Über PDF-Siebesiech"
          aria-label="Über PDF-Siebesiech"
          className="grid h-9 w-9 place-items-center rounded-lg border border-ink-200 bg-white text-ink-500 transition-colors hover:bg-ink-50 hover:text-ink-700"
        >
          <Info size={17} />
        </button>

        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) onOpenFiles(e.target.files)
            e.target.value = ''
          }}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-[13px] font-medium text-ink-700 transition-colors hover:bg-ink-50"
        >
          <FilePlus2 size={16} />
          Öffnen
        </button>

        <ExportControl
          canExport={canExport}
          busy={busy}
          pageCount={pageCount}
          selectedCount={selectedCount}
          onExport={onExport}
        />
      </div>
      </header>

      <AboutDialog open={aboutOpen} onClose={() => setAboutOpen(false)} />
    </>
  )
}

function ExportControl({
  canExport,
  busy,
  pageCount,
  selectedCount,
  onExport,
}: {
  canExport: boolean
  busy: boolean
  pageCount: number
  selectedCount: number
  onExport: (scope: ExportScope) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Split nur sinnvoll, wenn eine echte Teilmenge ausgewählt ist.
  const canSplit = selectedCount > 0 && selectedCount < pageCount

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('mousedown', onDown)
    return () => window.removeEventListener('mousedown', onDown)
  }, [open])

  const primaryClass = cn(
    'inline-flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-semibold text-white transition-colors',
    'bg-brand-600 hover:bg-brand-700 disabled:pointer-events-none disabled:opacity-40',
  )

  if (!canSplit) {
    return (
      <button
        type="button"
        onClick={() => onExport('all')}
        disabled={!canExport || busy}
        className={cn(primaryClass, 'rounded-lg')}
      >
        {busy ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          <Download size={16} />
        )}
        Exportieren
      </button>
    )
  }

  return (
    <div ref={ref} className="relative flex">
      <button
        type="button"
        onClick={() => onExport('all')}
        disabled={busy}
        className={cn(primaryClass, 'rounded-l-lg')}
      >
        {busy ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          <Download size={16} />
        )}
        Exportieren
      </button>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={busy}
        aria-label="Exportoptionen"
        aria-expanded={open}
        className={cn(
          primaryClass,
          'rounded-r-lg border-l border-white/25 px-1.5',
        )}
      >
        <ChevronDown
          size={16}
          className={cn('transition-transform', open && 'rotate-180')}
        />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-40 mt-1.5 w-60 animate-pop-in overflow-hidden rounded-xl border border-ink-200 bg-white p-1 shadow-panel">
          <MenuItem
            icon={<Download size={16} />}
            title="Alle Seiten"
            hint={`${pageCount} Seiten · ganzes Dokument`}
            onClick={() => {
              setOpen(false)
              onExport('all')
            }}
          />
          <MenuItem
            icon={<Scissors size={16} />}
            title="Nur Auswahl"
            hint={`${selectedCount} ${selectedCount === 1 ? 'Seite' : 'Seiten'} als eigenes PDF`}
            onClick={() => {
              setOpen(false)
              onExport('selection')
            }}
          />
        </div>
      )}
    </div>
  )
}

function MenuItem({
  icon,
  title,
  hint,
  onClick,
}: {
  icon: React.ReactNode
  title: string
  hint: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-ink-50"
    >
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-ink-100 text-ink-600">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-[13px] font-medium text-ink-800">
          {title}
        </span>
        <span className="block truncate text-[11px] text-ink-500">{hint}</span>
      </span>
    </button>
  )
}

function ToolbarIcon({
  children,
  onClick,
  title,
}: {
  children: React.ReactNode
  onClick: () => void
  title: string
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="grid h-7 w-7 place-items-center rounded-md text-ink-600 transition-colors hover:bg-white"
    >
      {children}
    </button>
  )
}

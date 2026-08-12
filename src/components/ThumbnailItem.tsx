import { memo } from 'react'
import type React from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { PageDescriptor } from '../engine/types'
import { useThumbnail } from '../hooks/useThumbnail'
import { cn } from '../lib/utils'

export const THUMB_WIDTH = 168

interface Props {
  page: PageDescriptor
  number: number
  selected: boolean
  active: boolean
  onSelect: (e: React.MouseEvent | React.KeyboardEvent) => void
  /** Herkunftsfarbe (nur gesetzt, wenn mehrere Dokumente geladen sind). */
  docColor?: string
  /** Name der Quelle (für Tooltip und Herkunfts-Chip). */
  docName?: string
  /** Chip mit Dokumentnamen anzeigen (erste Seite eines Herkunfts-Laufs). */
  showDocLabel?: boolean
}

function ThumbnailItemBase({
  page,
  number,
  selected,
  active,
  onSelect,
  docColor,
  docName,
  showDocLabel,
}: Props) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: page.id })

  const url = useThumbnail(page.docId, page.sourceIndex, page.rotation, THUMB_WIDTH)

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <li
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onSelect}
      data-page-id={page.id}
      title={docName}
      className={cn(
        'group relative flex cursor-default flex-col items-center gap-1.5 rounded-xl px-2 py-2 no-select outline-none',
        isDragging && 'opacity-0',
      )}
    >
      {showDocLabel && docName && (
        <span
          className="max-w-full truncate rounded-full px-2 py-0.5 text-[10px] font-semibold leading-tight"
          style={{ color: docColor, backgroundColor: docColor + '1f' }}
        >
          {docName}
        </span>
      )}
      <div
        className={cn(
          'relative overflow-hidden rounded-md bg-white transition-shadow',
          'ring-1 ring-black/10',
          selected
            ? 'shadow-page-active ring-2 ring-brand-500'
            : 'shadow-page group-hover:ring-black/20',
        )}
        style={{ width: THUMB_WIDTH }}
      >
        {docColor && (
          <span
            className="absolute left-0 top-0 z-10 h-full w-1"
            style={{ backgroundColor: docColor }}
            aria-hidden
          />
        )}
        {url ? (
          <img
            src={url}
            alt={`Seite ${number}`}
            draggable={false}
            className="block h-auto w-full"
          />
        ) : (
          <div
            className="w-full animate-pulse bg-ink-100"
            style={{ height: Math.round(THUMB_WIDTH * 1.414) }}
          />
        )}
      </div>

      <span
        className={cn(
          'rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums transition-colors',
          selected
            ? 'bg-brand-500 text-white'
            : active
              ? 'bg-ink-200 text-ink-800'
              : 'text-ink-500 group-hover:bg-ink-200/70',
        )}
      >
        {number}
      </span>
    </li>
  )
}

export const ThumbnailItem = memo(ThumbnailItemBase)

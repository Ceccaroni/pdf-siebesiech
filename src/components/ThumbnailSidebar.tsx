import { useRef, useState } from 'react'
import type React from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { RotateCcw, RotateCw, Copy, Trash2 } from 'lucide-react'
import { useStore, type SelectMode } from '../state/store'
import { ThumbnailItem, THUMB_WIDTH } from './ThumbnailItem'
import { useThumbnail } from '../hooks/useThumbnail'
import { useDocMeta } from '../lib/docColors'
import type { PageDescriptor } from '../engine/types'
import { cn } from '../lib/utils'

export function ThumbnailSidebar() {
  const { state, dispatch } = useStore()
  const { pages, selectedIds, activeId } = state
  const selected = new Set(selectedIds)
  const docMeta = useDocMeta()
  const multiDoc = docMeta.size > 1

  const [dragId, setDragId] = useState<string | null>(null)
  const movingRef = useRef<string[]>([])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function selectModeFrom(e: React.MouseEvent | React.KeyboardEvent): SelectMode {
    if (e.shiftKey) return 'range'
    if (e.metaKey || e.ctrlKey) return 'toggle'
    return 'single'
  }

  function handleSelect(page: PageDescriptor, e: React.MouseEvent | React.KeyboardEvent) {
    dispatch({ type: 'SELECT', id: page.id, mode: selectModeFrom(e) })
  }

  function onDragStart(e: DragStartEvent) {
    const id = String(e.active.id)
    setDragId(id)
    if (selected.has(id) && selectedIds.length > 1) {
      // Ganze Auswahl (in Seitenreihenfolge) als Block bewegen.
      movingRef.current = pages.filter((p) => selected.has(p.id)).map((p) => p.id)
    } else {
      movingRef.current = [id]
      if (!selected.has(id)) dispatch({ type: 'SELECT', id, mode: 'single' })
    }
  }

  function onDragEnd(e: DragEndEvent) {
    setDragId(null)
    const { active, over } = e
    if (!over || active.id === over.id) return

    const ids = pages.map((p) => p.id)
    const moving = movingRef.current
    const movingSet = new Set(moving)

    if (moving.length <= 1) {
      const oldIndex = ids.indexOf(String(active.id))
      const newIndex = ids.indexOf(String(over.id))
      if (oldIndex < 0 || newIndex < 0) return
      dispatch({ type: 'SET_PAGE_ORDER', ids: arrayMove(ids, oldIndex, newIndex) })
      return
    }

    // Mehrfachauswahl als Block einfügen.
    const remaining = ids.filter((id) => !movingSet.has(id))
    const overOriginal = ids.indexOf(String(over.id))
    let insertIndex: number
    if (movingSet.has(String(over.id))) {
      insertIndex = remaining.findIndex((id) => ids.indexOf(id) > overOriginal)
      if (insertIndex === -1) insertIndex = remaining.length
    } else {
      const overInRemaining = remaining.indexOf(String(over.id))
      const draggedOriginal = ids.indexOf(String(active.id))
      insertIndex = draggedOriginal < overOriginal ? overInRemaining + 1 : overInRemaining
    }
    const newOrder = [
      ...remaining.slice(0, insertIndex),
      ...moving,
      ...remaining.slice(insertIndex),
    ]
    dispatch({ type: 'SET_PAGE_ORDER', ids: newOrder })
  }

  function onKeyDown(e: React.KeyboardEvent) {
    const mod = e.metaKey || e.ctrlKey
    if (mod && e.key.toLowerCase() === 'a') {
      e.preventDefault()
      dispatch({ type: 'SELECT_ALL' })
    } else if (mod && e.key.toLowerCase() === 'd') {
      e.preventDefault()
      dispatch({ type: 'DUPLICATE' })
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault()
      dispatch({ type: 'DELETE' })
    } else if (e.key === '[') {
      e.preventDefault()
      dispatch({ type: 'ROTATE', delta: -90 })
    } else if (e.key === ']') {
      e.preventDefault()
      dispatch({ type: 'ROTATE', delta: 90 })
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      const idx = pages.findIndex((p) => p.id === activeId)
      if (idx < 0) return
      const next = e.key === 'ArrowDown' ? idx + 1 : idx - 1
      const target = pages[next]
      if (target) {
        dispatch({
          type: 'SELECT',
          id: target.id,
          mode: e.shiftKey ? 'range' : 'single',
        })
        // aktive Kachel in den sichtbaren Bereich scrollen
        document
          .querySelector(`[data-page-id="${target.id}"]`)
          ?.scrollIntoView({ block: 'nearest' })
      }
    }
  }

  const hasSelection = selectedIds.length > 0
  const dragPage = dragId ? pages.find((p) => p.id === dragId) : null
  const dragCount = movingRef.current.length

  return (
    <aside className="flex h-full w-[264px] shrink-0 flex-col border-r border-ink-200 bg-ink-50">
      {/* Kopf mit Auswahl-Aktionen */}
      <div className="flex items-center justify-between border-b border-ink-200 px-3 py-2">
        <div className="text-[13px] font-semibold text-ink-700">
          Seiten
          <span className="ml-1.5 font-normal text-ink-400">
            {selectedIds.length > 1
              ? `${selectedIds.length} ausgewählt`
              : pages.length}
          </span>
        </div>
        <div className="flex items-center gap-0.5">
          <IconBtn title="Nach links drehen ([)" onClick={() => dispatch({ type: 'ROTATE', delta: -90 })} disabled={!hasSelection}>
            <RotateCcw size={16} />
          </IconBtn>
          <IconBtn title="Nach rechts drehen (])" onClick={() => dispatch({ type: 'ROTATE', delta: 90 })} disabled={!hasSelection}>
            <RotateCw size={16} />
          </IconBtn>
          <IconBtn title="Duplizieren (⌘D)" onClick={() => dispatch({ type: 'DUPLICATE' })} disabled={!hasSelection}>
            <Copy size={16} />
          </IconBtn>
          <IconBtn title="Löschen (⌫)" onClick={() => dispatch({ type: 'DELETE' })} disabled={!hasSelection} danger>
            <Trash2 size={16} />
          </IconBtn>
        </div>
      </div>

      {/* Liste */}
      <div
        className="flex-1 overflow-y-auto overflow-x-hidden py-2 outline-none"
        tabIndex={0}
        onKeyDown={onKeyDown}
        aria-label="Seitenübersicht"
      >
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onDragCancel={() => setDragId(null)}
        >
          <SortableContext items={ids(pages)} strategy={verticalListSortingStrategy}>
            <ul className="flex flex-col items-center">
              {pages.map((p, i) => {
                const meta = multiDoc ? docMeta.get(p.docId) : undefined
                return (
                  <ThumbnailItem
                    key={p.id}
                    page={p}
                    number={i + 1}
                    selected={selected.has(p.id)}
                    active={p.id === activeId}
                    onSelect={(e) => handleSelect(p, e)}
                    docColor={meta?.color}
                    docName={meta?.name}
                    showDocLabel={!!meta && pages[i - 1]?.docId !== p.docId}
                  />
                )
              })}
            </ul>
          </SortableContext>

          <DragOverlay dropAnimation={null}>
            {dragPage ? <DragPreview page={dragPage} count={dragCount} /> : null}
          </DragOverlay>
        </DndContext>
      </div>
    </aside>
  )
}

function ids(pages: PageDescriptor[]): string[] {
  return pages.map((p) => p.id)
}

function DragPreview({ page, count }: { page: PageDescriptor; count: number }) {
  const url = useThumbnail(page.docId, page.sourceIndex, page.rotation, THUMB_WIDTH)
  return (
    <div className="relative -rotate-2" style={{ width: THUMB_WIDTH }}>
      <div className="overflow-hidden rounded-md bg-white shadow-2xl ring-2 ring-brand-500">
        {url && <img src={url} alt="" className="block h-auto w-full" draggable={false} />}
      </div>
      {count > 1 && (
        <span className="absolute -right-2 -top-2 grid h-6 min-w-6 place-items-center rounded-full bg-brand-600 px-1.5 text-xs font-bold text-white shadow-md ring-2 ring-white">
          {count}
        </span>
      )}
    </div>
  )
}

function IconBtn({
  children,
  onClick,
  title,
  disabled,
  danger,
}: {
  children: React.ReactNode
  onClick: () => void
  title: string
  disabled?: boolean
  danger?: boolean
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'grid h-8 w-8 place-items-center rounded-lg text-ink-600 transition-colors',
        'hover:bg-ink-200/70 disabled:pointer-events-none disabled:opacity-30',
        danger && 'hover:bg-brand-50 hover:text-brand-600',
      )}
    >
      {children}
    </button>
  )
}

import type React from 'react'
import {
  MousePointer2,
  Type,
  Square,
  PenLine,
  Minus,
  Plus,
  Trash2,
} from 'lucide-react'
import { useStore } from '../state/store'
import { TEXT_COLORS } from '../engine/types'
import { cn } from '../lib/utils'

export function EditorToolbar({ disabled }: { disabled?: boolean }) {
  const { state, dispatch } = useStore()
  const { tool, selectedAnnotationId, annotations } = state
  const selected = annotations.find((a) => a.id === selectedAnnotationId) ?? null

  return (
    <div className="pointer-events-auto flex items-center gap-1 rounded-xl border border-ink-200 bg-white/95 p-1 shadow-panel backdrop-blur">
      <ToolButton
        active={tool === 'select'}
        disabled={disabled}
        title="Auswählen / Verschieben"
        onClick={() => dispatch({ type: 'SET_TOOL', tool: 'select' })}
      >
        <MousePointer2 size={17} />
      </ToolButton>
      <ToolButton
        active={tool === 'text'}
        disabled={disabled}
        title="Text hinzufügen"
        onClick={() => dispatch({ type: 'SET_TOOL', tool: 'text' })}
      >
        <Type size={17} />
      </ToolButton>
      <ToolButton
        active={tool === 'whiteout'}
        disabled={disabled}
        title="Weissfläche (abdecken)"
        onClick={() => dispatch({ type: 'SET_TOOL', tool: 'whiteout' })}
      >
        <Square size={17} />
      </ToolButton>
      <ToolButton
        active={tool === 'redigieren'}
        disabled={disabled}
        title="Text korrigieren (bestehenden Text in Originalschrift ändern)"
        onClick={() => dispatch({ type: 'SET_TOOL', tool: 'redigieren' })}
      >
        <PenLine size={17} />
      </ToolButton>

      {selected && (
        <>
          <span className="mx-1 h-6 w-px bg-ink-200" />
          {selected.kind === 'text' && (
            <div className="flex items-center gap-0.5">
              <MiniBtn
                title="Kleiner"
                onClick={() =>
                  dispatch({
                    type: 'UPDATE_ANNOTATION',
                    id: selected.id,
                    patch: { fontSize: Math.max(6, selected.fontSize - 2) },
                  })
                }
              >
                <Minus size={15} />
              </MiniBtn>
              <span className="w-8 text-center text-xs font-medium tabular-nums text-ink-600">
                {Math.round(selected.fontSize)}
              </span>
              <MiniBtn
                title="Grösser"
                onClick={() =>
                  dispatch({
                    type: 'UPDATE_ANNOTATION',
                    id: selected.id,
                    patch: { fontSize: Math.min(96, selected.fontSize + 2) },
                  })
                }
              >
                <Plus size={15} />
              </MiniBtn>
            </div>
          )}

          <div className="ml-1 flex items-center gap-1">
            {TEXT_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                title={`Farbe ${c}`}
                onClick={() =>
                  dispatch({
                    type: 'UPDATE_ANNOTATION',
                    id: selected.id,
                    patch: { color: c },
                  })
                }
                className={cn(
                  'h-5 w-5 rounded-full border transition-transform hover:scale-110',
                  selected.color.toLowerCase() === c.toLowerCase()
                    ? 'border-brand-500 ring-2 ring-brand-200'
                    : 'border-ink-300',
                )}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>

          <span className="mx-1 h-6 w-px bg-ink-200" />
          <MiniBtn
            title="Anmerkung löschen"
            danger
            onClick={() =>
              dispatch({ type: 'DELETE_ANNOTATION', id: selected.id })
            }
          >
            <Trash2 size={15} />
          </MiniBtn>
        </>
      )}
    </div>
  )
}

function ToolButton({
  children,
  active,
  onClick,
  title,
  disabled,
}: {
  children: React.ReactNode
  active?: boolean
  onClick: () => void
  title: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'grid h-9 w-9 place-items-center rounded-lg transition-colors disabled:pointer-events-none disabled:opacity-30',
        active
          ? 'bg-brand-600 text-white'
          : 'text-ink-600 hover:bg-ink-100',
      )}
    >
      {children}
    </button>
  )
}

function MiniBtn({
  children,
  onClick,
  title,
  danger,
}: {
  children: React.ReactNode
  onClick: () => void
  title: string
  danger?: boolean
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cn(
        'grid h-7 w-7 place-items-center rounded-md text-ink-600 transition-colors hover:bg-ink-100',
        danger && 'hover:bg-brand-50 hover:text-brand-600',
      )}
    >
      {children}
    </button>
  )
}

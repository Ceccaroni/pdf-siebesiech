import {
  createContext,
  useContext,
  useMemo,
  useReducer,
  type Dispatch,
  type ReactNode,
} from 'react'
import type {
  Annotation,
  PageDescriptor,
  Rotation,
  SourceDoc,
  TextAnnotation,
  Tool,
} from '../engine/types'
import { normalizeRotation } from '../engine/types'
import { newId } from '../lib/utils'

export interface AppState {
  sources: Record<string, SourceDoc>
  pages: PageDescriptor[]
  selectedIds: string[]
  anchorId: string | null
  activeId: string | null
  annotations: Annotation[]
  tool: Tool
  selectedAnnotationId: string | null
}

export const initialState: AppState = {
  sources: {},
  pages: [],
  selectedIds: [],
  anchorId: null,
  activeId: null,
  annotations: [],
  tool: 'select',
  selectedAnnotationId: null,
}

export type SelectMode = 'single' | 'toggle' | 'range'

export type Action =
  | { type: 'ADD_SOURCE'; source: SourceDoc }
  | { type: 'SET_PAGE_ORDER'; ids: string[] }
  | { type: 'SELECT'; id: string; mode: SelectMode }
  | { type: 'SELECT_ALL' }
  | { type: 'CLEAR_SELECTION' }
  | { type: 'SET_ACTIVE'; id: string }
  | { type: 'ROTATE'; ids?: string[]; delta: 90 | -90 | 180 }
  | { type: 'DELETE'; ids?: string[] }
  | { type: 'DUPLICATE'; ids?: string[] }
  | { type: 'SET_TOOL'; tool: Tool }
  | { type: 'ADD_ANNOTATION'; annotation: Annotation }
  | {
      type: 'UPDATE_ANNOTATION'
      id: string
      patch: Partial<Omit<TextAnnotation, 'id' | 'pageId' | 'kind'>> & {
        nw?: number
        nh?: number
      }
    }
  | { type: 'DELETE_ANNOTATION'; id: string }
  | { type: 'SELECT_ANNOTATION'; id: string | null }
  | { type: 'RESET' }

function indexOfId(pages: PageDescriptor[], id: string | null): number {
  if (id == null) return -1
  return pages.findIndex((p) => p.id === id)
}

function targetIds(state: AppState, ids?: string[]): string[] {
  if (ids && ids.length) return ids
  return state.selectedIds
}

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'ADD_SOURCE': {
      const { source } = action
      const newPages: PageDescriptor[] = Array.from(
        { length: source.pageCount },
        (_, i) => ({
          id: newId(),
          docId: source.id,
          sourceIndex: i,
          rotation: 0 as Rotation,
        }),
      )
      const pages = [...state.pages, ...newPages]
      const activeId = state.activeId ?? newPages[0]?.id ?? null
      return {
        ...state,
        sources: { ...state.sources, [source.id]: source },
        pages,
        activeId,
        anchorId: state.anchorId ?? activeId,
        selectedIds:
          state.selectedIds.length === 0 && newPages[0]
            ? [newPages[0].id]
            : state.selectedIds,
      }
    }

    case 'SET_PAGE_ORDER': {
      const byId = new Map(state.pages.map((p) => [p.id, p]))
      const pages = action.ids
        .map((id) => byId.get(id))
        .filter((p): p is PageDescriptor => Boolean(p))
      // Falls IDs fehlen sollten: unveränderte anhängen (Robustheit).
      if (pages.length !== state.pages.length) {
        for (const p of state.pages) if (!action.ids.includes(p.id)) pages.push(p)
      }
      return { ...state, pages }
    }

    case 'SELECT': {
      const { id, mode } = action
      if (mode === 'single') {
        return { ...state, selectedIds: [id], anchorId: id, activeId: id }
      }
      if (mode === 'toggle') {
        const has = state.selectedIds.includes(id)
        const selectedIds = has
          ? state.selectedIds.filter((x) => x !== id)
          : [...state.selectedIds, id]
        return {
          ...state,
          selectedIds,
          anchorId: id,
          activeId: has ? state.activeId : id,
        }
      }
      // range
      const anchorIdx = indexOfId(state.pages, state.anchorId ?? id)
      const targetIdx = indexOfId(state.pages, id)
      const [lo, hi] =
        anchorIdx <= targetIdx ? [anchorIdx, targetIdx] : [targetIdx, anchorIdx]
      const selectedIds = state.pages.slice(lo, hi + 1).map((p) => p.id)
      return { ...state, selectedIds, activeId: id }
    }

    case 'SELECT_ALL':
      return {
        ...state,
        selectedIds: state.pages.map((p) => p.id),
        activeId: state.activeId ?? state.pages[0]?.id ?? null,
      }

    case 'CLEAR_SELECTION':
      return { ...state, selectedIds: state.activeId ? [state.activeId] : [] }

    case 'SET_ACTIVE':
      return { ...state, activeId: action.id }

    case 'ROTATE': {
      const ids = new Set(targetIds(state, action.ids))
      if (ids.size === 0) return state
      const pages = state.pages.map((p) =>
        ids.has(p.id)
          ? { ...p, rotation: normalizeRotation(p.rotation + action.delta) }
          : p,
      )
      return { ...state, pages }
    }

    case 'DELETE': {
      const ids = new Set(targetIds(state, action.ids))
      if (ids.size === 0) return state
      const firstIdx = state.pages.findIndex((p) => ids.has(p.id))
      const pages = state.pages.filter((p) => !ids.has(p.id))
      // Aktive/Selektion auf die Position der ersten gelöschten Seite setzen.
      const nextActive =
        pages[Math.min(firstIdx, pages.length - 1)]?.id ?? null
      return {
        ...state,
        pages,
        // Anmerkungen gelöschter Seiten mitentfernen.
        annotations: state.annotations.filter((a) => !ids.has(a.pageId)),
        selectedIds: nextActive ? [nextActive] : [],
        anchorId: nextActive,
        activeId: nextActive,
      }
    }

    case 'DUPLICATE': {
      const ids = new Set(targetIds(state, action.ids))
      if (ids.size === 0) return state
      const result: PageDescriptor[] = []
      const newSelection: string[] = []
      const clonedAnnotations: Annotation[] = []
      for (const p of state.pages) {
        result.push(p)
        if (ids.has(p.id)) {
          const dup: PageDescriptor = { ...p, id: newId() }
          result.push(dup)
          newSelection.push(dup.id)
          // Anmerkungen der Quellseite mitkopieren.
          for (const a of state.annotations) {
            if (a.pageId === p.id) {
              clonedAnnotations.push({ ...a, id: newId(), pageId: dup.id })
            }
          }
        }
      }
      return {
        ...state,
        pages: result,
        annotations: [...state.annotations, ...clonedAnnotations],
        selectedIds: newSelection,
        anchorId: newSelection[0] ?? state.anchorId,
        activeId: newSelection[0] ?? state.activeId,
      }
    }

    case 'SET_TOOL':
      return { ...state, tool: action.tool, selectedAnnotationId: null }

    case 'ADD_ANNOTATION':
      return {
        ...state,
        annotations: [...state.annotations, action.annotation],
        selectedAnnotationId: action.annotation.id,
      }

    case 'UPDATE_ANNOTATION':
      return {
        ...state,
        annotations: state.annotations.map((a) =>
          a.id === action.id ? ({ ...a, ...action.patch } as Annotation) : a,
        ),
      }

    case 'DELETE_ANNOTATION':
      return {
        ...state,
        annotations: state.annotations.filter((a) => a.id !== action.id),
        selectedAnnotationId:
          state.selectedAnnotationId === action.id
            ? null
            : state.selectedAnnotationId,
      }

    case 'SELECT_ANNOTATION':
      return { ...state, selectedAnnotationId: action.id }

    case 'RESET':
      return initialState

    default:
      return state
  }
}

interface StoreValue {
  state: AppState
  dispatch: Dispatch<Action>
}

const StoreContext = createContext<StoreValue | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState)
  const value = useMemo(() => ({ state, dispatch }), [state])
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore muss innerhalb von StoreProvider stehen')
  return ctx
}

/** Bequemer Zugriff auf die Quelle einer Seite. */
export function useSourcesMap(): Map<string, SourceDoc> {
  const { state } = useStore()
  return useMemo(() => new Map(Object.entries(state.sources)), [state.sources])
}

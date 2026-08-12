import type { Dispatch } from 'react'
import { openDocument } from '../engine/pdfEngine'
import { newId } from '../lib/utils'
import type { Action } from './store'

export interface ImportResult {
  added: number
  errors: string[]
}

function isPdf(file: File): boolean {
  return (
    file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
  )
}

/** Liest PDF-Dateien ein, lädt sie in die Engine und legt sie im Store an. */
export async function importFiles(
  files: FileList | File[],
  dispatch: Dispatch<Action>,
): Promise<ImportResult> {
  const list = Array.from(files)
  const errors: string[] = []
  let added = 0

  for (const file of list) {
    if (!isPdf(file)) {
      errors.push(`„${file.name}" ist keine PDF-Datei.`)
      continue
    }
    try {
      const buffer = await file.arrayBuffer()
      const bytes = new Uint8Array(buffer)
      const docId = newId()
      const { pageCount } = await openDocument(docId, bytes)
      dispatch({
        type: 'ADD_SOURCE',
        source: { id: docId, name: file.name, bytes, pageCount },
      })
      added++
    } catch (err) {
      errors.push(
        `„${file.name}" konnte nicht geöffnet werden${
          err instanceof Error ? `: ${err.message}` : ''
        }.`,
      )
    }
  }

  return { added, errors }
}

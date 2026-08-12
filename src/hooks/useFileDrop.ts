import { useEffect, useRef, useState } from 'react'

/**
 * Fenster-weites Drag & Drop für Dateien. Meldet, ob gerade eine Datei über
 * dem Fenster schwebt, und ruft `onDrop` mit den abgelegten Dateien auf.
 */
export function useFileDrop(onDrop: (files: FileList) => void): boolean {
  const [isDragging, setDragging] = useState(false)
  const counter = useRef(0)
  const cb = useRef(onDrop)
  cb.current = onDrop

  useEffect(() => {
    function hasFiles(e: DragEvent): boolean {
      return Array.from(e.dataTransfer?.types ?? []).includes('Files')
    }
    function onEnter(e: DragEvent) {
      if (!hasFiles(e)) return
      e.preventDefault()
      counter.current++
      setDragging(true)
    }
    function onOver(e: DragEvent) {
      if (!hasFiles(e)) return
      e.preventDefault()
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
    }
    function onLeave(e: DragEvent) {
      if (!hasFiles(e)) return
      counter.current = Math.max(0, counter.current - 1)
      if (counter.current === 0) setDragging(false)
    }
    function onDropEvent(e: DragEvent) {
      if (!hasFiles(e)) return
      e.preventDefault()
      counter.current = 0
      setDragging(false)
      if (e.dataTransfer?.files?.length) cb.current(e.dataTransfer.files)
    }

    window.addEventListener('dragenter', onEnter)
    window.addEventListener('dragover', onOver)
    window.addEventListener('dragleave', onLeave)
    window.addEventListener('drop', onDropEvent)
    return () => {
      window.removeEventListener('dragenter', onEnter)
      window.removeEventListener('dragover', onOver)
      window.removeEventListener('dragleave', onLeave)
      window.removeEventListener('drop', onDropEvent)
    }
  }, [])

  return isDragging
}

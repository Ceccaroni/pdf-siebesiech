import { useEffect, useState } from 'react'
import { renderPage } from '../engine/pdfEngine'

// Einfacher FIFO-Cache für gerenderte Thumbnails (Object-URLs).
// Deckelt den Speicher — wichtig auf schwacher Hardware.
const MAX_CACHE = 400
const cache = new Map<string, string>()

function cacheGet(key: string): string | undefined {
  return cache.get(key)
}

function cachePut(key: string, url: string): void {
  cache.set(key, url)
  while (cache.size > MAX_CACHE) {
    const oldestKey = cache.keys().next().value as string | undefined
    if (oldestKey === undefined) break
    const oldUrl = cache.get(oldestKey)
    cache.delete(oldestKey)
    if (oldUrl) URL.revokeObjectURL(oldUrl)
  }
}

/**
 * Rendert (oder holt aus Cache) ein Thumbnail für eine Quellseite.
 * Gibt eine Object-URL oder null (während des Ladens) zurück.
 */
export function useThumbnail(
  docId: string,
  sourceIndex: number,
  rotation: number,
  width: number,
): string | null {
  const bucket = Math.round(width)
  const key = `${docId}:${sourceIndex}:${rotation}:${bucket}`
  const [url, setUrl] = useState<string | null>(() => cacheGet(key) ?? null)

  useEffect(() => {
    const cached = cacheGet(key)
    if (cached) {
      setUrl(cached)
      return
    }
    let cancelled = false
    setUrl(null)
    renderPage(docId, sourceIndex, {
      targetWidth: bucket,
      rotationDelta: rotation,
      dpr: typeof window !== 'undefined' ? window.devicePixelRatio : 1,
    })
      .then(({ blob }) => {
        if (cancelled) return
        const objUrl = URL.createObjectURL(blob)
        cachePut(key, objUrl)
        setUrl(objUrl)
      })
      .catch((e) => {
        console.error('Thumbnail-Render fehlgeschlagen:', e)
      })
    return () => {
      cancelled = true
    }
  }, [key, docId, sourceIndex, rotation, bucket])

  return url
}

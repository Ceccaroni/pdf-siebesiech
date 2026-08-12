import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createHash } from 'node:crypto'

// App-Version aus package.json — einzige Quelle, wird unten als __APP_VERSION__
// ins Frontend injiziert (z. B. für den „Über"-Dialog).
const pkg = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
) as { version: string }

/**
 * Trägt nach dem Build die vollständige Liste der Build-Assets in den
 * Service-Worker ein (ersetzt den `self.__PDF_PRECACHE__`-Platzhalter). So lädt
 * der Worker beim Installieren alle Dateien vor — inkl. pdf.js-Worker — und die
 * App ist ab dem ersten Offline-Start wasserdicht, ohne dass man erst jede
 * Funktion antippen muss.
 */
function swPrecache(): Plugin {
  let precache: string[] = []
  let outDir = 'dist'
  return {
    name: 'sw-precache',
    apply: 'build',
    writeBundle(options, bundle) {
      outDir = options.dir ?? 'dist'
      const assets = Object.keys(bundle)
        .filter((f) => !f.endsWith('.map') && f !== 'sw.js')
        .map((f) => './' + f)
      // start_url + public-Assets, die nicht Teil des Rollup-Bundles sind.
      precache = Array.from(
        new Set(['./', ...assets, './manifest.webmanifest', './favicon.svg']),
      )
    },
    // closeBundle läuft nach dem Kopieren von public/ — dann existiert dist/sw.js.
    closeBundle() {
      const swPath = join(outDir, 'sw.js')
      try {
        // Cache-Name aus der Precache-Liste (enthält Content-Hashes) ableiten →
        // jeder inhaltlich neue Build bekommt einen eigenen Cache.
        const token = createHash('sha1')
          .update(precache.join('|'))
          .digest('hex')
          .slice(0, 8)
        const cacheName = `pdf-siebesiech-${token}`
        const src = readFileSync(swPath, 'utf8')
        writeFileSync(
          swPath,
          src
            .replace('self.__PDF_PRECACHE__', JSON.stringify(precache))
            .replace('self.__PDF_CACHE__', JSON.stringify(cacheName)),
        )
      } catch (err) {
        this.warn(`sw.js konnte nicht mit Precache-Liste versehen werden: ${err}`)
      }
    },
  }
}

// Relative base ('./') macht den Build portabel: funktioniert gehostet in einem
// Unterpfad (GitHub Pages) genauso wie beim Öffnen aus einem Unterordner.
// https://vite.dev/config/
export default defineConfig({
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [react(), swPrecache()],
  build: {
    target: 'es2022',
    // Chunks grosszügig lassen — pdf.js/pdf-lib sind bewusst gebündelt.
    chunkSizeWarningLimit: 2000,
  },
})

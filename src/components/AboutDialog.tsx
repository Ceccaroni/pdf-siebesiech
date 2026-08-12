import { useEffect, useState, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { LogoMark } from './Logo'

export function AboutDialog({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Schliessen"
        onClick={onClose}
        className="absolute inset-0 cursor-default animate-fade-in bg-ink-950/40 backdrop-blur-sm"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Über PDF-Siebesiech"
        className="relative w-full max-w-md animate-pop-in overflow-hidden rounded-2xl bg-white shadow-panel"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Schliessen"
          className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-lg text-ink-400 transition-colors hover:bg-ink-100"
        >
          <X size={17} />
        </button>

        {/* Kopf */}
        <div className="flex items-center gap-3 px-5 pb-4 pt-5">
          <LogoMark size={44} />
          <div>
            <div className="text-lg font-semibold tracking-tight text-ink-900">
              <span className="text-brand-600">PDF</span>
              <span className="text-ink-400">-</span>Siebesiech
            </div>
            <div className="text-[12px] font-medium text-ink-400">
              Version {__APP_VERSION__}
            </div>
          </div>
        </div>

        {/* Inhalt */}
        <div className="space-y-4 border-t border-ink-100 px-5 py-4 text-[13px] leading-relaxed text-ink-600">
          <p>
            PDFs lesen, Seiten ordnen und bearbeiten — komplett im Browser, ohne
            Installation und ohne Adminrechte.
          </p>

          <Section title="Datenschutz">
            Alles bleibt auf dem Gerät. Deine PDFs werden nicht hochgeladen und
            nicht gespeichert — sie liegen nur im Arbeitsspeicher und sind beim
            Schliessen des Tabs wieder weg. Der Offline-Speicher enthält
            ausschliesslich die App selbst, niemals deine Dokumente.
          </Section>

          <Section title="Offline & Aktualisierung">
            Einmal mit Internet geladen, läuft die App danach vollständig
            offline. Eine neue Version wird beim nächsten Start mit Internet
            automatisch übernommen, der alte Zwischenspeicher dabei ersetzt.
          </Section>

          <p className="text-[12px] text-ink-400">
            Läuft mit pdf.js (Apache-2.0) und pdf-lib (MIT). Kein Server, keine
            Cloud.
          </p>
        </div>

        {/* Fuss: Schule Huttwil */}
        <div className="flex items-center justify-center gap-2 border-t border-ink-100 bg-ink-50 px-5 py-4">
          <SchuleHuttwilLogo />
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-0.5 text-[12px] font-semibold uppercase tracking-wide text-ink-500">
        {title}
      </div>
      <p>{children}</p>
    </div>
  )
}

/**
 * Zeigt das Schul-Logo aus public/ an, sobald es abgelegt ist
 * (`schule-huttwil-logo.svg` oder `.png`). Fehlt es, erscheint stattdessen
 * dezent der Schriftzug — es bricht also nichts, bevor die Datei da ist.
 */
function SchuleHuttwilLogo() {
  const candidates = ['./schule-huttwil-logo.svg', './schule-huttwil-logo.png']
  const [idx, setIdx] = useState(0)
  const [failed, setFailed] = useState(false)

  if (failed) {
    return (
      <span className="text-[13px] font-medium text-ink-500">
        Schule Huttwil
      </span>
    )
  }

  return (
    <img
      src={candidates[idx]}
      alt="Schule Huttwil"
      className="h-10 w-auto max-w-[220px] object-contain"
      onError={() =>
        idx < candidates.length - 1 ? setIdx(idx + 1) : setFailed(true)
      }
    />
  )
}

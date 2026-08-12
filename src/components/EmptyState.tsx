import { useRef } from 'react'
import type React from 'react'
import { FilePlus2, MousePointerClick, Layers, RotateCw } from 'lucide-react'
import { LogoMark } from './Logo'

export function EmptyState({ onOpenFiles }: { onOpenFiles: (files: FileList) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div className="flex h-full flex-1 items-center justify-center bg-ink-100 p-8">
      <div className="w-full max-w-md animate-fade-in text-center">
        <div className="mx-auto mb-6 w-fit rounded-3xl bg-white p-4 shadow-panel">
          <LogoMark size={72} />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink-900">
          PDF-Siebesiech
        </h1>
        <p className="mx-auto mt-2 max-w-sm text-[15px] leading-relaxed text-ink-500">
          PDFs öffnen, Seiten per Drag &amp; Drop ordnen, drehen, löschen und
          neu speichern. Läuft komplett im Browser — nichts verlässt dein Gerät,
          keine Installation nötig.
        </p>

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
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700"
        >
          <FilePlus2 size={18} />
          PDF öffnen
        </button>
        <p className="mt-3 text-xs text-ink-400">
          … oder Datei einfach hierher ziehen
        </p>

        <div className="mt-9 grid grid-cols-3 gap-3 text-left">
          <Feature icon={<Layers size={16} />} label="Seiten ordnen" />
          <Feature icon={<RotateCw size={16} />} label="Drehen &amp; löschen" />
          <Feature icon={<MousePointerClick size={16} />} label="Wie bei Apple" />
        </div>
      </div>
    </div>
  )
}

function Feature({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="rounded-xl border border-ink-200 bg-white/60 px-3 py-3">
      <div className="mb-1.5 grid h-7 w-7 place-items-center rounded-lg bg-brand-50 text-brand-600">
        {icon}
      </div>
      <div className="text-[12px] font-medium leading-tight text-ink-600">
        {label}
      </div>
    </div>
  )
}

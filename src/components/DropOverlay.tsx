import { FileDown } from 'lucide-react'

export function DropOverlay() {
  return (
    <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-brand-950/40 p-8 backdrop-blur-sm animate-fade-in">
      <div className="flex flex-col items-center gap-4 rounded-3xl border-2 border-dashed border-white/80 bg-white/10 px-16 py-12 text-white">
        <FileDown size={56} strokeWidth={1.5} />
        <div className="text-lg font-semibold">PDF hier ablegen</div>
        <div className="text-sm text-white/80">Loslassen zum Öffnen</div>
      </div>
    </div>
  )
}

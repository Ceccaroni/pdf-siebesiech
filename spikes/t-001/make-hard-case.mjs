// Erzeugt den SCHWIERIGEN Testfall: eingebetteter, gesubsetteter TrueType-Font
// (Carlito ~ Calibri) => Type0/CIDFontType2 mit Identity-H. Der Text steht dann
// NICHT im Klartext, sondern als 2-Byte-Glyph-IDs (<hex>) — wie Word/Canva/LO.
import { readFileSync, writeFileSync } from 'node:fs'
import { PDFDocument, rgb } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'

const doc = await PDFDocument.create()
doc.registerFontkit(fontkit)
const font = await doc.embedFont(readFileSync('public/fonts/carlito-regular.ttf'), { subset: true })

const page = doc.addPage([420, 594])
// Läufe mit bekannten Baseline-Positionen (y in PDF-Punkten von unten):
const lines = [
  { text: 'Name: Erika Mustermann', y: 540 },
  { text: 'Adresse: Musterweg 7, 3550 Langnau', y: 515 },
  { text: 'Note: 5.5', y: 490 },
  { text: 'Datum: 12.08.2026', y: 465 },
]
for (const l of lines) {
  page.drawText(l.text, { x: 40, y: l.y, size: 14, font, color: rgb(0.1, 0.1, 0.1) })
}

const bytes = await doc.save()
writeFileSync('spikes/t-001/hard-case.pdf', bytes)
console.log('hard-case.pdf erstellt (', bytes.length, 'Bytes ) — Subset/CID-Font')

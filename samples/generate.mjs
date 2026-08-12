// Erzeugt ein mehrseitiges Beispiel-PDF zum Testen (Node, pdf-lib).
import { PDFDocument, StandardFonts, rgb, degrees } from 'pdf-lib'
import { writeFileSync } from 'node:fs'

const doc = await PDFDocument.create()
const font = await doc.embedFont(StandardFonts.HelveticaBold)
const body = await doc.embedFont(StandardFonts.Helvetica)

const colors = [
  rgb(0.93, 0.3, 0.26),
  rgb(0.98, 0.7, 0.2),
  rgb(0.2, 0.6, 0.86),
  rgb(0.3, 0.72, 0.5),
  rgb(0.55, 0.4, 0.85),
  rgb(0.95, 0.45, 0.6),
]

for (let i = 0; i < 6; i++) {
  const page = doc.addPage([420, 594]) // A5-ish hochkant
  const c = colors[i]
  page.drawRectangle({ x: 0, y: 0, width: 420, height: 594, color: rgb(1, 1, 1) })
  page.drawRectangle({ x: 0, y: 494, width: 420, height: 100, color: c })
  page.drawText(`Seite ${i + 1}`, { x: 32, y: 524, size: 40, font, color: rgb(1, 1, 1) })
  page.drawText('PDF-Siebesiech Testdokument', { x: 32, y: 440, size: 16, font: body, color: rgb(0.2, 0.2, 0.2) })
  page.drawText('Ziehe mich in der Miniaturleiste herum,', { x: 32, y: 410, size: 13, font: body, color: rgb(0.35, 0.35, 0.35) })
  page.drawText('drehe oder loesche mich.', { x: 32, y: 392, size: 13, font: body, color: rgb(0.35, 0.35, 0.35) })
  page.drawText(String(i + 1), { x: 300, y: 60, size: 120, font, color: rgb(0.92, 0.92, 0.9) })
  page.drawText('unten rechts', { x: 300, y: 40, size: 10, font: body, color: c, rotate: degrees(0) })
}

const bytes = await doc.save()
writeFileSync(new URL('./beispiel.pdf', import.meta.url), bytes)
console.log('Beispiel-PDF erstellt: samples/beispiel.pdf (', bytes.length, 'Bytes )')

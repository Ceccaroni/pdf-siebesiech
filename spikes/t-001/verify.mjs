// T-001 Spike — Verifikations-Harness. Fährt beide Szenarien und prüft mit
// externem pdftotext, dass (1) der Ziel-Text nicht mehr extrahierbar ist und
// (2) der übrige Text erhalten bleibt. pdftotext/qpdf sind reine Test-Tools.
import { readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { PDFDocument } from 'pdf-lib'
import { surgeryOnPage } from './surgery.mjs'

const OUT = process.env.SCRATCH || '/tmp'

function pdftotext(path) {
  return execFileSync('pdftotext', [path, '-'], { encoding: 'utf8' })
}
function qpdfOk(path) {
  try { execFileSync('qpdf', ['--check', path], { encoding: 'utf8' }); return true }
  catch (e) { return /No syntax or stream encoding errors/.test(e.stdout || '') }
}

let pass = 0, fail = 0
function check(label, cond) {
  if (cond) { pass++; console.log(`  ✓ ${label}`) }
  else { fail++; console.log(`  ✗ ${label}`) }
}

async function run(name, inPath, targets, mustBeGone, mustRemain) {
  console.log(`\n▓ ${name}`)
  const doc = await PDFDocument.load(readFileSync(inPath))
  const removed = await surgeryOnPage(doc, 0, targets)
  const outPath = `${OUT}/${name}.pdf`
  writeFileSync(outPath, await doc.save())
  const txt = pdftotext(outPath)
  console.log(`  entfernt: ${removed.length} Operator(en) — ${removed.map(r => `${r.op}@(${r.x},${r.y})`).join(', ')}`)
  for (const g of mustBeGone) check(`entfernt: "${g}" nicht mehr extrahierbar`, !txt.includes(g))
  for (const r of mustRemain) check(`erhalten: "${r}" noch da`, txt.includes(r))
  check('PDF valide (qpdf --check)', qpdfOk(outPath))
}

// Szenario 1 — einfacher Fall (pdf-lib/StandardFont, Klartext-Strings)
await run(
  'einfach',
  'samples/beispiel.pdf',
  [{ text: 'Seite 1', x: 32, y: 524 }],
  ['Seite 1'],
  ['PDF-Siebesiech Testdokument', 'unten rechts'],
)

// Szenario 2 — schwieriger Fall (Subset/CID-Font, Glyph-IDs) => nur Position matcht
await run(
  'schwer',
  'spikes/t-001/hard-case.pdf',
  [{ x: 40, y: 490, ignoreText: true }], // "Note: 5.5"
  ['Note: 5.5'],
  ['Name: Erika Mustermann', 'Adresse: Musterweg 7, 3550 Langnau', 'Datum: 12.08.2026'],
)

// Szenario 3 — mehrere Ziele gleichzeitig (Name + Note raus, Rest bleibt)
await run(
  'mehrfach',
  'spikes/t-001/hard-case.pdf',
  [
    { x: 40, y: 540, ignoreText: true }, // Name
    { x: 40, y: 465, ignoreText: true }, // Datum
  ],
  ['Erika Mustermann', 'Datum: 12.08.2026'],
  ['Adresse: Musterweg 7, 3550 Langnau', 'Note: 5.5'],
)

console.log(`\n=== Ergebnis: ${pass} ok, ${fail} fehlgeschlagen ===`)
process.exit(fail ? 1 : 0)

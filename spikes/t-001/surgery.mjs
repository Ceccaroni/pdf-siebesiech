// T-001 Spike — Content-Stream-Chirurgie (Option A aus dem Ticket)
// Ziel: einen einzelnen Text-Lauf WIRKLICH aus dem Content-Stream entfernen,
// nicht nur überdecken. Browser-portabel gedacht: nur pdf-lib + Flate
// (hier Node zlib; im Browser => pako [via pdf-lib gebündelt] oder
// DecompressionStream). KEIN qpdf/mupdf im Produktivpfad — qpdf nutzen wir nur
// als externes VERIFIKATIONS-Tool, nicht als Abhängigkeit.
//
// Aufruf:  node spikes/t-001/surgery.mjs <in.pdf> <out.pdf>
// Die zu entfernenden Läufe stehen unten in TARGETS (Text + PDF-Punkt-Position).

import { readFileSync, writeFileSync } from 'node:fs'
import zlib from 'node:zlib'
import { PDFDocument, PDFName, PDFArray, PDFRawStream, PDFRef } from 'pdf-lib'

// --- Ein Content-Stream-Tokenizer (minimal, aber korrekt für die üblichen Fälle) ---
// Arbeitet auf einer Latin1-Repräsentation (1 Zeichen == 1 Byte), damit
// Byte-Offsets fürs Herausschneiden exakt bleiben.

const isWS = (c) => c === ' ' || c === '\t' || c === '\r' || c === '\n' || c === '\f' || c === '\0'
const isDelim = (c) => c === '(' || c === ')' || c === '<' || c === '>' || c === '[' || c === ']' || c === '{' || c === '}' || c === '/' || c === '%'

function decodeLiteral(s, start) {
  // s[start] === '('  → gibt {text, end}
  let i = start + 1
  let depth = 1
  let out = ''
  const n = s.length
  while (i < n && depth > 0) {
    const c = s[i]
    if (c === '\\') {
      const nx = s[i + 1]
      if (nx === 'n') { out += '\n'; i += 2 }
      else if (nx === 'r') { out += '\r'; i += 2 }
      else if (nx === 't') { out += '\t'; i += 2 }
      else if (nx === 'b') { out += '\b'; i += 2 }
      else if (nx === 'f') { out += '\f'; i += 2 }
      else if (nx === '(') { out += '('; i += 2 }
      else if (nx === ')') { out += ')'; i += 2 }
      else if (nx === '\\') { out += '\\'; i += 2 }
      else if (nx >= '0' && nx <= '7') {
        let oct = nx; i += 2; let k = 0
        while (k < 2 && s[i] >= '0' && s[i] <= '7') { oct += s[i]; i++; k++ }
        out += String.fromCharCode(parseInt(oct, 8) & 0xff)
      } else if (nx === '\r' || nx === '\n') { // Zeilenfortsetzung
        i += 2; if (nx === '\r' && s[i] === '\n') i++
      } else { out += nx; i += 2 }
    } else if (c === '(') { depth++; out += c; i++ }
    else if (c === ')') { depth--; if (depth > 0) out += c; i++ }
    else { out += c; i++ }
  }
  return { text: out, end: i }
}

function decodeHex(s, start) {
  // s[start] === '<'  (kein '<<') → gibt {text, end}
  let i = start + 1
  let hex = ''
  const n = s.length
  while (i < n && s[i] !== '>') { if (!isWS(s[i])) hex += s[i]; i++ }
  i++ // '>' schlucken
  if (hex.length % 2) hex += '0'
  let out = ''
  for (let k = 0; k < hex.length; k += 2) out += String.fromCharCode(parseInt(hex.substr(k, 2), 16))
  return { text: out, end: i }
}

// Liest ein Array [...] und gibt die konkatenierten String-Anteile (für TJ).
function decodeArrayStrings(s, start) {
  let i = start + 1
  const n = s.length
  let out = ''
  while (i < n && s[i] !== ']') {
    const c = s[i]
    if (isWS(c)) { i++; continue }
    if (c === '(') { const r = decodeLiteral(s, i); out += r.text; i = r.end }
    else if (c === '<') { const r = decodeHex(s, i); out += r.text; i = r.end }
    else { i++ } // Zahlen (Kerning) überspringen
  }
  i++ // ']' schlucken
  return { text: out, end: i }
}

/**
 * Entfernt Text-Show-Operatoren, die einem Ziel entsprechen (Text + Position).
 * @param bytes  dekomprimierter Content-Stream (Uint8Array/Buffer)
 * @param targets Array<{text, x, y, tol?}>
 * @returns {out: Buffer, removed: Array}
 */
function removeShowOps(bytes, targets) {
  const s = Buffer.from(bytes).toString('latin1')
  const n = s.length
  let i = 0

  // Textzustand (vereinfachte Verfolgung der Translation; reicht für PDFs mit
  // identischer Skalierung in Tm — typische Formulare/Office-Exporte).
  let tm = [1, 0, 0, 1, 0, 0] // aktuelle Textmatrix
  let lm = [1, 0, 0, 1, 0, 0] // Zeilenmatrix (Startpunkt der Zeile)
  let leading = 0

  const stack = [] // Operanden (Zahlen als number, Strings als {str})
  let operandStart = -1 // Byte-Offset des ersten Operanden seit letztem Operator

  const removals = [] // {start, end, text, x, y}
  const removed = []

  const num = (v) => (typeof v === 'number' ? v : 0)

  const showAt = (text) => {
    const x = tm[4]
    const y = tm[5]
    for (const t of targets) {
      const tol = t.tol ?? 2
      const posOk = Math.abs(x - t.x) <= tol && Math.abs(y - t.y) <= tol
      if (!posOk) continue
      // Bei CID/Identity-Fonts steht im Stream nur Glyph-IDs, kein lesbarer Text
      // => Position ist der zuverlässige Schlüssel (pdf.js liefert Text+Position).
      // Text-Match nur als Zusatzabsicherung, wenn der Stream-String lesbar ist.
      if (t.ignoreText) return t
      if (text.includes(t.text)) return t
    }
    return null
  }

  while (i < n) {
    const c = s[i]
    if (isWS(c)) { i++; continue }
    if (c === '%') { while (i < n && s[i] !== '\n' && s[i] !== '\r') i++; continue }

    const tokStart = i
    let token // {kind, val}

    if (c === '(') {
      const r = decodeLiteral(s, i); i = r.end; token = { kind: 'str', val: r.text }
    } else if (c === '<' && s[i + 1] === '<') {
      // Inline-Dict (BDC/DP) — als Operand grob überspringen bis '>>'
      let depth = 0
      while (i < n) {
        if (s[i] === '<' && s[i + 1] === '<') { depth++; i += 2 }
        else if (s[i] === '>' && s[i + 1] === '>') { depth--; i += 2; if (depth === 0) break }
        else i++
      }
      token = { kind: 'dict' }
    } else if (c === '<') {
      const r = decodeHex(s, i); i = r.end; token = { kind: 'str', val: r.text }
    } else if (c === '[') {
      const r = decodeArrayStrings(s, i); i = r.end; token = { kind: 'str', val: r.text }
    } else if (c === '/') {
      i++; while (i < n && !isWS(s[i]) && !isDelim(s[i])) i++
      token = { kind: 'name' }
    } else if (c === ']' || c === '}' || c === '>') {
      i++; continue // verirrtes Schlusszeichen
    } else if ((c >= '0' && c <= '9') || c === '+' || c === '-' || c === '.') {
      let j = i + 1
      while (j < n && ((s[j] >= '0' && s[j] <= '9') || s[j] === '.' || s[j] === '-' || s[j] === '+' || s[j] === 'e' || s[j] === 'E')) j++
      token = { kind: 'num', val: parseFloat(s.slice(i, j)) }; i = j
    } else {
      // Operator-Keyword
      let j = i
      while (j < n && !isWS(s[j]) && !isDelim(s[j])) j++
      const op = s.slice(i, j); i = j

      // --- Textzustand ---
      if (op === 'BT') { tm = [1, 0, 0, 1, 0, 0]; lm = [...tm] }
      else if (op === 'Tm') {
        const a = stack.slice(-6)
        if (a.length === 6) { tm = a.map(num); lm = [...tm] }
      } else if (op === 'Td' || op === 'TD') {
        const tx = num(stack[stack.length - 2]); const ty = num(stack[stack.length - 1])
        if (op === 'TD') leading = -ty
        lm = [lm[0], lm[1], lm[2], lm[3], lm[4] + tx, lm[5] + ty]
        tm = [...lm]
      } else if (op === 'TL') {
        leading = num(stack[stack.length - 1])
      } else if (op === 'T*') {
        lm = [lm[0], lm[1], lm[2], lm[3], lm[4], lm[5] - leading]
        tm = [...lm]
      } else if (op === 'Tj') {
        const str = stack.length ? stack[stack.length - 1] : ''
        const text = typeof str === 'object' ? str.str : String(str)
        const hit = showAt(text)
        if (hit) { removals.push({ start: operandStart, end: i }); removed.push({ text, x: tm[4], y: tm[5], op }) }
      } else if (op === 'TJ') {
        const str = stack.length ? stack[stack.length - 1] : ''
        const text = typeof str === 'object' ? str.str : String(str)
        const hit = showAt(text)
        if (hit) { removals.push({ start: operandStart, end: i }); removed.push({ text, x: tm[4], y: tm[5], op }) }
      } else if (op === "'" || op === '"') {
        // Zeilenumbruch + Show
        lm = [lm[0], lm[1], lm[2], lm[3], lm[4], lm[5] - leading]
        tm = [...lm]
        const str = stack.length ? stack[stack.length - 1] : ''
        const text = typeof str === 'object' ? str.str : String(str)
        const hit = showAt(text)
        if (hit) { removals.push({ start: operandStart, end: i }); removed.push({ text, x: tm[4], y: tm[5], op }) }
      }

      stack.length = 0
      operandStart = -1
      continue
    }

    // Operand auf den Stack
    if (operandStart === -1) operandStart = tokStart
    if (token.kind === 'num') stack.push(token.val)
    else if (token.kind === 'str') stack.push({ str: token.val })
    else stack.push(token.kind) // name/dict als Platzhalter
  }

  if (!removals.length) return { out: Buffer.from(bytes), removed }

  // Von hinten nach vorn schneiden, damit Offsets gültig bleiben.
  removals.sort((a, b) => b.start - a.start)
  let edited = s
  for (const r of removals) edited = edited.slice(0, r.start) + edited.slice(r.end)
  return { out: Buffer.from(edited, 'latin1'), removed }
}

// --- pdf-lib-Anbindung: Content-Streams einer Seite holen, dekomprimieren, ersetzen ---

function inflateStream(raw) {
  const filter = raw.dict.lookup(PDFName.of('Filter'))
  const bytes = raw.contents
  const name = filter ? filter.toString() : ''
  if (name.includes('FlateDecode')) return zlib.inflateSync(Buffer.from(bytes))
  return Buffer.from(bytes) // unkomprimiert
}

export async function surgeryOnPage(doc, pageIndex, targets) {
  const page = doc.getPage(pageIndex)
  const contents = page.node.lookup(PDFName.of('Contents'))

  let refs = []
  if (contents instanceof PDFArray) {
    for (let k = 0; k < contents.size(); k++) {
      const el = contents.get(k)
      refs.push(el instanceof PDFRef ? el : el)
    }
  } else {
    const raw = page.node.get(PDFName.of('Contents'))
    refs.push(raw)
  }

  // Alle Streams dekomprimieren und (spec-konform) zu einem Content zusammenfügen.
  const parts = []
  for (const ref of refs) {
    const raw = ref instanceof PDFRef ? doc.context.lookup(ref) : ref
    if (raw instanceof PDFRawStream) parts.push(inflateStream(raw))
  }
  const joined = Buffer.concat(parts.flatMap((p, idx) => (idx ? [Buffer.from('\n'), p] : [p])))

  const { out, removed } = removeShowOps(joined, targets)

  // Als EIN neuer (Flate-)Content-Stream zurückschreiben.
  const compressed = zlib.deflateSync(out)
  const newStream = PDFRawStream.of(
    doc.context.obj({ Filter: 'FlateDecode', Length: compressed.length }),
    compressed,
  )
  const newRef = doc.context.register(newStream)
  page.node.set(PDFName.of('Contents'), newRef)

  return removed
}

// --- CLI (nur bei direktem Aufruf) ---
import { fileURLToPath } from 'node:url'
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [inPath, outPath] = process.argv.slice(2)
  if (!inPath || !outPath) {
    console.error('Aufruf: node surgery.mjs <in.pdf> <out.pdf>')
    process.exit(1)
  }
  const TARGETS = [{ text: 'Seite 1', x: 32, y: 524 }]
  const doc = await PDFDocument.load(readFileSync(inPath))
  const removed = await surgeryOnPage(doc, 0, TARGETS)
  const bytes = await doc.save()
  writeFileSync(outPath, bytes)
  console.log('Entfernte Show-Operatoren:', removed.length)
  for (const r of removed) console.log(`  ${r.op}  "${r.text}"  @ (${r.x}, ${r.y})`)
  console.log('Geschrieben:', outPath, `(${bytes.length} Bytes)`)
}

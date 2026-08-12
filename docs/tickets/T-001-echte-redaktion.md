# T-001 — Echte Redaktion: Originaltext wirklich entfernen (nicht nur überdecken)

- **Status:** offen (Backlog)
- **Priorität:** mittel-hoch (Vertrauens-/Datenschutzthema)
- **Erstellt:** 2026-08-12
- **Bezug:** Feature „Text korrigieren" (Phase 2c) — `src/lib/exportPdf.ts`,
  `src/components/PageEditor.tsx`, `src/engine/pdfEngine.ts`

## Kontext / Problem

Beim Werkzeug **„Text korrigieren"** (und bei der bestehenden Weissfläche) wird
der Originaltext nur **optisch überdeckt** (Rechteck in der abgetasteten
Hintergrundfarbe). Im PDF bleibt der alte Text jedoch im **Content-Stream**
erhalten und ist per Copy-Paste, „Text kopieren" oder `pdftotext` weiterhin
**auslesbar**.

Für den Schuleinsatz (Bewerbungen, Formulare, persönliche Angaben) ist das ein
echtes Datenschutz-/Vertrauensproblem: Ändert jemand z.B. Name, Adresse, Note
oder Datum, erwartet man, dass die alte Angabe **weg** ist — nicht bloss
verdeckt. Verlangt vom Nutzer explizit gewünscht.

## Ziel / Akzeptanzkriterien

1. Nach einer Korrektur (oder einer als „redaktion" markierten Weissfläche) ist
   der überdeckte Originaltext **nicht mehr aus dem exportierten PDF
   extrahierbar** (`pdftotext` zeigt ihn nicht, Copy-Paste findet ihn nicht).
2. Der restliche Seiteninhalt (anderer Text, Bilder, Layout) bleibt **unverändert
   und weiterhin als echter Text** erhalten (keine Voll-Rasterung der Seite als
   Default).
3. Läuft **vollständig clientseitig** (kein Server, keine AGPL-Abhängigkeit) auf
   der schwachen Zielhardware — konform zu CLAUDE.md (kein mupdf.js).
4. Kein Bruch bestehender Funktionen (freier Text, Weissfläche, Multi-Doc, Split,
   Rotation, Offline).

## Nicht-Ziele (bewusst)

- Kein Fliesstext-Reflow (bleibt).
- Keine forensisch perfekte Metadaten-Bereinigung (getrennt betrachten).
- Kein OCR / keine Redaktion in gescannten Bild-PDFs (dort ist ohnehin kein
  Text-Layer vorhanden).

## Technische Optionen

### Option A — Content-Stream-Chirurgie (empfohlen, „richtig")
Die Text-Zeichen-Operatoren des Ziel-Laufs gezielt aus dem Seiten-Content-Stream
entfernen.

- **Skizze:** Content-Stream der Seite dekomprimieren (meist FlateDecode) →
  Operatoren tokenisieren → die `Tj`/`TJ`/`'`/`"`-Operatoren finden, die den
  Ziel-Lauf rendern → entfernen (bzw. durch Positionierung ohne Ausgabe ersetzen)
  → neu kodieren. pdf-lib gibt Zugriff auf die Low-Level-Objekte
  (`PDFRawStream`, `PDFContentStream`, `PDFOperator`), aber **keine bequeme
  Edit-API** — der Parser/Editor ist selbst zu bauen.
- **Zuordnung Lauf → Operator:** pdf.js abstrahiert die Operatoren weg. Die
  Korrelation muss über die **Textmatrix/Position** (Tm/Td) + den String erfolgen
  (dieselbe Baseline/Position wie in `getPageTextRuns`), um den richtigen
  `TJ`-Operator zu treffen.
- **Fallstricke:** mehrere Content-Streams pro Seite; verschachtelte
  **Form-XObjects** mit eigenen Streams; Encodings/CID; Kompression; Auswirkung
  auf nachfolgende Positionierung (ein `TJ` schiebt die Textposition weiter —
  meist unkritisch, da Zeilen absolut per `Td`/`Tm` gesetzt werden, aber prüfen).
- **Aufwand:** hoch (eigener minimaler Content-Stream-Parser + Tests über diverse
  PDF-Ersteller: Canva/Quartz, Word, LibreOffice, InDesign).

### Option B — Seite (oder Band) rastern + neu aufbauen (Fallback, „einfach & sicher")
Nur als **opt-in pro Seite**: Seite via pdf.js zu einem Bild rendern, neues
PDF-Blatt = Bild + darüber die Korrekturen als echter Text.

- **Pro:** Originaltext ist garantiert weg (wird zu Pixeln). Einfach umzusetzen.
- **Contra:** die **ganze Seite verliert den Text-Layer** (nicht mehr durchsuchbar,
  schlechter für Barrierefreiheit), grösseres File, evtl. leicht weichere
  Druckqualität. Nur akzeptabel, wenn der Nutzer es bewusst wählt.
- **Aufwand:** niedrig-mittel.

### Option C — Redaktions-Annotation + Apply
Wie Acrobat (Redact-Annotation, dann „anwenden"). **Von pdf-lib nicht unterstützt**
→ verworfen (bräuchte mupdf/AGPL, ausgeschlossen).

## Empfehlung

**Zweistufig:**
1. **Kurzfristig (Sicherheit sofort):** Option B als **opt-in „Seite wirklich
   säubern"** anbieten — garantierte Entfernung, klare UI-Warnung („Seite wird
   zu Bild, Text nicht mehr durchsuchbar").
2. **Mittelfristig (das Richtige):** Option A als Standard für einzelne Läufe —
   entfernt nur den betroffenen Text, Rest bleibt echter Text. R&D-Spike zuerst:
   an je einem Canva-/Word-/LibreOffice-PDF prüfen, ob Lauf→`TJ`-Zuordnung und
   Neuschreiben stabil gelingt.

## Risiken / offene Fragen

- Robustheit von Option A über verschiedene PDF-Ersteller (grösstes Risiko).
- Verschlüsselte/komprimierte Streams, XObjects.
- UX: Wie unterscheiden wir „nur überdecken" (schnell, Text bleibt) von „echt
  entfernen" (sicher)? Vorschlag: Weissfläche/Korrektur bekommt einen Schalter
  **„sicher entfernen"**; Default weiterhin überdecken (schnell), mit Hinweis.
- Datenschutz-Kommunikation im „Über"-Dialog aktualisieren, sobald verfügbar.

## Aufwand (grob)

- Spike Option A: 0.5–1 Tag. Umsetzung Option A: 2–4 Tage inkl. Tests.
- Option B (Fallback): 0.5–1 Tag.

## Verweise

- `src/lib/exportPdf.ts` — hier würde die Stream-Bearbeitung ansetzen
  (aktuell: `copyPages` + `drawRectangle`/`drawText`).
- `src/engine/pdfEngine.ts` — `getPageTextRuns` liefert bereits Position/Baseline
  je Lauf (Korrelationsgrundlage für Option A) und kann Seiten rastern (Option B).
- CLAUDE.md — Architektur-Leitplanken (kein mupdf.js/AGPL).

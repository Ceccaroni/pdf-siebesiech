# ARCHIV — PDF-Siebesiech

Abgeschlossene Meilensteine (damit STATUS.md schlank bleibt).

## 2026-08-12 — Phase 1: Fundament
Setup (React + TS + Vite + Tailwind), Logo / Branding, PDF-Engine (pdf.js-Render
mit Render-Warteschlange für schwache Hardware), Öffnen + Datei-Drop,
Apple-artige Miniaturleiste (@dnd-kit), Hauptansicht + Zoom, Export (pdf-lib).
Build grün; Export- & pdf.js-Parse-Tests **PASS**.

## 2026-08-12 — Phase 2a: Text-Editing
Overlay-Editor, Text-Werkzeug + Weissfläche (Redigieren-und-Neusetzen),
normalisierte Koordinaten, Export zeichnet Anmerkungen real
(`drawText` / `drawRectangle`). Koordinaten-Test **PASS**.
- Fix: Editor rendert über **frisches Canvas → `<img>`** statt geteiltem Canvas
  (behob pdf.js „same canvas"-Fehler → weisse Seiten).

## 2026-08-12 — Phase 2b: Multi-Doc, Offline, „Über"
- **Multi-Dokument sichtbar:** Herkunftsfarben (`src/lib/docColors.ts`) — farbiger
  Streifen an jeder Kachel + Dok-Chip bei Herkunftswechsel (ab ≥2 PDFs). Merge lief
  modellseitig bereits (mehrere Quellen → eine Seitenliste → ein PDF).
- **Split:** Export-Button wird bei Teilauswahl zum ▾-Menü („Alle Seiten" / „Nur
  Auswahl" → eigenes PDF). Fix: Dropdown lag hinter dem Blatt → Header `relative z-30`.
- **PWA / Offline:** Service-Worker (`public/sw.js`) + `manifest.webmanifest` +
  Vite-Precache-Plugin (`vite.config.ts`) → alle Assets inkl. pdf.js-Worker im
  Precache, Cache-Name pro Build (sauberer Update-Wechsel). Cacht **nur App-Code,
  nie Nutzer-PDFs**; nichts wird persistiert.
  - **Fix (Bug „offline → weisse Seite"):** Vite lädt JS/CSS `crossorigin`, Server
    setzt dafür `Vary: Origin` → `caches.match` verfehlte den gecachten Eintrag
    (Opera streng nach Spec, Chrome nachsichtig). Behoben mit `ignoreVary: true`.
    Ursache per headless-Chrome (puppeteer-core) diagnostiziert + Mechanismus bewiesen.
- **„Über"-Dialog:** Info-Button in der TopBar — Version (aus `package.json` via
  `__APP_VERSION__` = 0.3.0), Datenschutz- & Offline-Info, automatischer Logo-Slot
  für Schule Huttwil (`public/schule-huttwil-logo.svg`/`.png`, Fallback = Text).
- Offline nach dem Fix im echten Opera (privat, frisch) **verifiziert**.

## 2026-08-12 — Phase 2c: „Text korrigieren" in Originalschrift
Bestehenden PDF-Text anklicken und in der **erkannten Originalschrift** an
**exakt derselben Grundlinie** neu setzen — nahtlos (das, was Acrobat nicht kann),
durch bewussten Verzicht (kein Reflow) + Mitliefern echter Schriften.
- **Textextraktion:** `getPageTextRuns` (`src/engine/pdfEngine.ts`) via pdf.js
  `getTextContent`, im ungedrehten User-Space → normalisiert 0..1 (= Export-Raum).
  Realer Fontname über `commonObjs` (nach `getOperatorList`); `styles`-Dict liefert
  nur generisch „sans-serif".
- **Schrift-Registry** (`src/engine/fonts.ts`): Matcher (Subset-Präfix strippen,
  Gewicht/Stil parsen) → gebündelte Familien **Montserrat, Carlito (=Calibri),
  Poppins, Lato** (`public/fonts/`, OFL/Apache) oder Standard-14; **on-demand
  geladen** (keine Grundlast, SW cacht offline). Kein Treffer → Ersatz + Badge
  „Schrift angenähert". Grundlinien-Messung via Canvas für WYSIWYG-Vorschau.
- **Werkzeug „Text korrigieren"** (`EditorToolbar`/`PageEditor`): Hotspots über
  erkannten Läufen, Klick erzeugt Korrektur (Weissfläche + Textfeld, vorbefüllt),
  grundlinien-genaue Vorschau, Scan-/Fehler-Hinweise.
- **Echtfarben-Abtastung:** Weissfläche nimmt den **Median der Pixel** unter dem
  Lauf → unsichtbar auch auf getöntem Hintergrund (z.B. Canva-Verlauf).
- **Export** (`src/lib/exportPdf.ts`): `@pdf-lib/fontkit`, gematchte Schrift
  **subset-eingebettet**, Text an exakter Grundlinie. Modell: `TextAnnotation` um
  optionale Felder `font`/`box`/`baseNy`/`origin` erweitert (Bestehendes unberührt).
- Validierung: Fontname-Rückgewinnung, Koordinaten und Export (pdffonts:
  Montserrat subset-eingebettet, **+3 KB**) an echtem Canva-PDF **PASS**; Optik
  (Datum nahtlos, kein Kasten) am gerenderten Export bestätigt. Build grün, Lint sauber.
- **Offen** → Ticket `docs/tickets/T-001-echte-redaktion.md` (Originaltext wirklich
  aus dem Content-Stream entfernen, nicht nur überdecken).

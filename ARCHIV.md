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

## 2026-08-12 — Rollout: Git, GitHub Pages, Schülermaterial
- **Git initialisiert** + Repo `Ceccaroni/pdf-siebesiech` (public) erstellt, gepusht.
- **GitHub Pages Live-Deploy** via Actions (`.github/workflows/deploy.yml`):
  Push auf `main` → Build → Pages, automatisch. Live-URL verifiziert (curl,
  HTTP 200, JS-Bundle + Worker laden korrekt).
- **Schülermaterial** (`unterricht/`): `index.html` (Zugang — Link + Adresse zum
  Abtippen, bewusst **ohne QR-Code**, da Zielgeräte keine Kamera haben) und
  `anleitung.html` (Bedienung in einfacher Sprache, 9. Klasse Real, Schweizer
  «ss») — beide self-contained HTML, per Doppelklick offen- und druckbar.
- T-001-Spike (Content-Stream-Chirurgie) durchgeführt und dokumentiert
  (`spikes/t-001/`, siehe Phase 2c oben) — 14/14 Verifikationen grün.

## 2026-08-13 — „Text korrigieren": Absätze statt Einzelzeilen
Bisher liess sich pro Klick nur eine einzelne Zeile korrigieren. Neu: ganze
Absätze in einem Rutsch.
- **Blockerkennung** (`src/engine/textBlocks.ts`, neu): geometrische Heuristik
  gruppiert `TextRun[]` zu Zeilen (Baseline-Nähe) und Zeilen zu Absätzen
  (gleicher linker Rand/Schrift/Grösse, normaler Zeilenabstand — grosse Lücke
  = neuer Absatz). Bekannte Grenze: erkennt weder zentrierte Absätze noch
  Erstzeilen-Einzug (bleiben Einzeilen-Blöcke).
- **Editier-Feld**: Korrekturen (mit Weissfläche) laufen jetzt über ein echtes
  `<textarea>` statt `contentEditable` — nativ mehrzeilig, wrappt an der
  Original-Box-Breite. Freier Text (ohne Box) unverändert `contentEditable`.
- **Export** (`wrapParagraph` in `exportPdf.ts`): identischer Greedy-Wortumbruch
  mit pdf-lib-Textmetrik an derselben Box-Breite → WYSIWYG zwischen Vorschau
  und Export. Zeilenabstand nutzt bei Mehrzeilern den echten Original-Abstand
  (`TextAnnotation.lineGap`, normalisiert), sonst wie bisher `size*1.15`.
- **Verifiziert (headless):** Blockerkennung an synthetischen Zeilen (Absätze
  korrekt getrennt/zusammengeführt), Wortumbruch mit echten pdf-lib-Metriken,
  voller Rundweg Annotation→`assemblePdf`→`pdftotext`. **Noch offen:** visueller
  Browser-Check (Hotspot-Klick, Textarea-Auto-Höhe, Grundlinien-Optik) — siehe
  STATUS.md Nächste Schritte.

## 2026-09-03 — Auto-Update: neue App-Version automatisch laden
PWA-Stolperstein behoben: Bei einem neuen Build tauscht der Service-Worker per
`skipWaiting`/`clientsClaim` nur den Worker aus — die bereits geladene Seite lief mit
dem **alten** Bundle weiter, bis man manuell neu lud.
- **Neu:** `src/lib/appUpdate.ts` (`initAutoUpdate` in `main.tsx`, `setSafeToReload`
  in `App.tsx`) lädt genau **einmal** neu, sobald ein neuer Worker übernimmt (echter
  `controllerchange`, **nicht** die SW-Erst-Übernahme beim unkontrollierten
  Erstbesuch/Hard-Reload — sonst würde ein Update derselben Sitzung verschluckt).
  **Aufgeschoben**, solange ein Dokument offen ist (im Speicher gehaltene PDFs/
  Anmerkungen → kein Datenverlust); nach dem Schliessen wird der Reload nachgeholt.
- **Verifiziert (Playwright, echtes Update simuliert:** Version-Bump → Rebuild →
  `registration.update()`): Erstbesuch kein Reload · Update im Leerzustand genau ein
  Reload · Update bei offenem Dokument aufgeschoben und nach Schliessen nachgeholt.
  Build grün, Lint sauber. Commit `9bbdaa5`, gepusht, **live** (Build+Deploy grün).
- **Hinweis:** greift automatisch erst ab dem *übernächsten* Update — bestehende
  Browser brauchen für dieses eine noch einen manuellen Reload (der alte Code kennt
  den Handler nicht).

## 2026-08-13 — Fix: gescannte Dokumente (JBIG2) leer in der Vorschau
**Live-Bug-Report** aus dem Schuleinsatz: Scans von Multifunktionsdruckern
(Xerox) zeigten in der Editor-Vorschau fast nichts (nur vereinzelte Linien),
Export war unauffällig korrekt.
- **Ursache gefunden:** pdf.js 6.x braucht für seinen WASM-JBIG2-Decoder einen
  expliziten `wasmUrl`-Parameter; ohne ihn scheitert die Initialisierung still,
  JBIG2-Bildobjekte werden beim Rendern komplett ignoriert (`getOperatorList -
  ignoring XObject`). Die App hatte `wasmUrl` nie gesetzt, die WASM-Dateien
  waren weder gebaut noch deployt (404 live).
- **Diagnose-Weg:** `pdfimages -list` zeigte 8 JBIG2-Stencils (Xerox' „Mixed
  Raster Content"-Scanmodus: JPEG-Hintergrund + JBIG2-Textmasken) identisch in
  Original und Export → Export unverdächtig (`copyPages` kopiert unverändert).
  Poppler (`pdftoppm`) rendert die Original-Datei einwandfrei → Datei intakt,
  Fehler isoliert in pdf.js. Reproduziert mit **echtem pdfjs-dist 6.2.108** in
  Node (`@napi-rs/canvas`) und final mit **echtem Chromium** (Playwright,
  lokaler Webroot mit den echten Projekt-Dateien) — exakt dieselbe Fehlermeldung
  wie live, dann mit Fix: **0 Warnungen**, Render deckungsgleich mit Poppler.
- **Fix:** `public/wasm/*.wasm` (4 Dateien, ~900 KB, lazy geladen wie die
  Zusatzschriften) + `wasmUrl` in `getDocument()` (`src/engine/pdfEngine.ts`).
  Live deployt und verifiziert (`wasm/jbig2.wasm` liefert HTTP 200).

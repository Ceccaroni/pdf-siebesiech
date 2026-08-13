# STATUS — PDF-Siebesiech

_Aktualisiert: 2026-08-12_

## 🚀 LIVE (Rollout-fähig)
- **App online:** https://ceccaroni.github.io/pdf-siebesiech/ (HTTPS, verifiziert 200).
- **Deploy:** GitHub Pages via Actions (`.github/workflows/deploy.yml`) — jeder Push
  auf `main` geht automatisch live. Repo: `Ceccaroni/pdf-siebesiech` (public).
- **Für die Schulklasse (Merge/Split) einsatzbereit.** Schülermaterial in `unterricht/`:
  `index.html` (Zugang/„so öffnest du's") + `anleitung.html` (Bedienung, 2 Aufgaben) —
  self-contained, per Doppelklick öffen- und druckbar (auch von USB).
- _Empfehlung morgen früh:_ 5 Min `npm run preview` als visueller Smoke-Test von
  Öffnen → Merge → Export → „Nur Auswahl“.

## Stand
Phase 1, 2a, 2b **und 2c fertig & lauffähig** (Build grün, Lint sauber).
Neu diese Session: **Schul-Logo** im „Über"-Dialog (`public/schule-huttwil-logo.svg`)
und **„Text korrigieren"** — bestehenden PDF-Text anklicken und in der
**Originalschrift** an derselben Stelle neu setzen (nahtlos, inkl. Echtfarben-
Abtastung der Weissfläche). Details siehe ARCHIV.md.

**Läuft:** Öffnen (Klick / Drop) · Miniaturleiste (DnD, Mehrfachauswahl, drehen /
löschen / duplizieren) · **Multi-Dokument** (Merge, Herkunftsfarben) · Zoom ·
Editor (Text · Weissfläche · **Text korrigieren in Originalschrift**) · Export
**+ Split** · **PWA/Offline** · „Über"-Dialog mit Logo.

## Nächste Schritte
1. **Browser-Gegencheck der Vorschau** (offen aus 2c, jetzt erweitert): Export ist
   end-to-end validiert (Node), die **Editor-Vorschau** wurde grundlinien-genau
   umgebaut, aber noch nicht im echten Browser gegengeprüft. `npm run dev` →
   Motischreiben → Stift → Datumszeile → sitzt es deckungsgleich?
   **Neu (2026-08-13): Absatz-Korrektur.** „Text korrigieren" gruppiert jetzt
   ganze Absätze statt Einzelzeilen (`src/engine/textBlocks.ts`, geometrische
   Heuristik: gleicher Rand/Schrift/Zeilenabstand). Editier-Feld ist neu ein
   `<textarea>` (nativ mehrzeilig, wrappt an der Original-Box-Breite); Export
   wrappt mit derselben Logik (`wrapParagraph` in `exportPdf.ts`, pdf-lib-
   Textmetrik) — WYSIWYG zwischen Vorschau und Export. **Headless verifiziert:**
   Gruppierungs-Heuristik mit synthetischen Zeilen (Absätze korrekt getrennt/
   zusammengeführt), Wortumbruch mit echten pdf-lib-Metriken, voller Rundweg
   Annotation→`assemblePdf`→`pdftotext` (Absatz vollständig, korrekt umgebrochen).
   **Noch nicht geprüft:** visuelles Editor-Erlebnis (Hotspot-Klick, Textarea-
   Auto-Höhe, Grundlinien-Optik bei echten mehrzeiligen Absätzen) — Teil des
   obigen Browser-Gegenchecks. Bekannte Grenzen der Heuristik: erkennt keine
   zentrierten Absätze und keinen Erstzeilen-Einzug (bleiben Einzeilen-Blöcke).
2. **T-001 — Echte Redaktion** (vom Nutzer gewünscht): Originaltext wirklich aus
   dem Content-Stream entfernen, nicht nur überdecken.
   → `docs/tickets/T-001-echte-redaktion.md`.
   **Spike gefahren (2026-08-12): Option A ist machbar** — `spikes/t-001/` + Befund
   in `spikes/t-001/BEFUND.md`, 14/14 Verifikations-Assertions grün (auch der
   Subset/CID-Fall via Positions-Match). Offene Risiken vor Integration:
   `TJ`-Zeilen-Granularität (ganze Zeile in einem Operator) + Form-XObjects.
   Nächster Schritt: an echten Word-/Canva-/LibreOffice-Exporten gegentesten.
3. **Formularfelder** ausfüllen (AcroForm, pdf-lib `getForm()`) — bewusst *später*.
4. **Single-File-Build**: eine `index.html` für USB / `file://` ohne Server
   (braucht Inlinen des pdf.js-Workers).

## Bekannte Grenzen
- **„Text korrigieren"** nur auf echten Text (keine Scans) und **0°-Seiten**;
  Ersatzschrift bei nicht gebündelter Familie → Badge „angenähert"; kein Reflow.
- **Weissfläche/Korrektur überdeckt nur optisch** — Originaltext bleibt im
  Text-Layer auslesbar (→ Ticket T-001).
- **Service-Worker brauchen HTTPS** (oder localhost). GitHub Pages ✓. Reiner
  HTTP-Schulserver ⇒ SW inaktiv, App nur online (→ dann Single-File-Build).
- Ein Font (Helvetica) für **freien** Text; Text-Baseline WYSIWYG-nah.

## Offen / optional
- ~~Git initialisieren~~ **erledigt** — Repo `Ceccaroni/pdf-siebesiech` (main).
- ~~Verteilung GitHub Pages~~ **erledigt & live** (s. oben). Schul-Webserver bei Bedarf
  zusätzlich möglich (`dist/`), **HTTPS** für Offline/PWA.
- Optional: Schülermaterial (`unterricht/`) zusätzlich online stellen — dazu Dateien
  nach `public/` verschieben, dann per `.../pdf-siebesiech/anleitung.html` erreichbar.
- Gebündelte Fonts (`public/fonts/`, ~8.5 MB) sind lazy-geladen → keine Grundlast;
  bei Bedarf weitere Familien ergänzen.

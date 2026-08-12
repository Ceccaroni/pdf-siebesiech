# STATUS — PDF-Siebesiech

_Aktualisiert: 2026-08-12_

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
1. **Browser-Gegencheck der Vorschau** (offen aus 2c): Export ist end-to-end
   validiert (Node), die **Editor-Vorschau** wurde grundlinien-genau umgebaut,
   aber noch nicht im echten Browser gegengeprüft. `npm run dev` → Motischreiben →
   Stift → Datumszeile → sitzt es deckungsgleich?
2. **T-001 — Echte Redaktion** (vom Nutzer gewünscht): Originaltext wirklich aus
   dem Content-Stream entfernen, nicht nur überdecken.
   → `docs/tickets/T-001-echte-redaktion.md`.
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
- Git noch **nicht** initialisiert (optional: `git init`).
- Verteilung: `dist/` auf GitHub Pages / Schul-Webserver (**HTTPS!**) legen.
- Gebündelte Fonts (`public/fonts/`, ~8.5 MB) sind lazy-geladen → keine Grundlast;
  bei Bedarf weitere Familien ergänzen.

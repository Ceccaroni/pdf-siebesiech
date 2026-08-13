# STATUS — PDF-Siebesiech

_Aktualisiert: 2026-08-13_

## 🚀 LIVE
- **App online:** https://ceccaroni.github.io/pdf-siebesiech/ (HTTPS, verifiziert).
- **Deploy:** GitHub Pages via Actions — jeder Push auf `main` geht automatisch live.
  Repo: `Ceccaroni/pdf-siebesiech` (public).
- Erster Schuleinsatz (Merge/Split) lief; ein Live-Bug wurde während der Stunde
  gemeldet und noch am selben Tag behoben + deployt (siehe ARCHIV.md, 2026-08-13
  „Fix: gescannte Dokumente").

## Stand
Phase 1, 2a, 2b, 2c fertig & live. **„Text korrigieren" gruppiert jetzt Absätze**
statt nur Einzelzeilen (`src/engine/textBlocks.ts`, mehrzeiliges Textfeld,
Wortumbruch spiegelt sich 1:1 im Export). **Gescannte Dokumente (JBIG2, z.B.
Xerox-Multifunktionsdrucker) rendern jetzt korrekt** in der Vorschau (WASM-
Decoder-Fix). Details zu allem: ARCHIV.md.

**Läuft:** Öffnen (Klick / Drop) · Miniaturleiste (DnD, Mehrfachauswahl, drehen /
löschen / duplizieren) · Multi-Dokument (Merge, Herkunftsfarben) · Zoom ·
Editor (Text · Weissfläche · Text korrigieren **in Absätzen**, Originalschrift)
· Export + Split · PWA/Offline · „Über"-Dialog · Schülermaterial (`unterricht/`).

## Nächste Schritte
1. **Browser-Gegencheck der Vorschau** (weiterhin offen): Export ist end-to-end
   validiert (Node/Playwright), aber das **visuelle Editor-Erlebnis** wurde nie
   live im eigenen Dev-Server geprüft — insbesondere die neue Absatz-Korrektur
   (Textarea-Auto-Höhe, Grundlinien-Optik bei echten Mehrzeilern) und generell
   Motischreiben/Stift/Datumszeile. `npm run dev` → einmal alle Werkzeuge durchklicken.
2. **T-001 — Echte Redaktion** (vom Nutzer gewünscht): Originaltext wirklich aus
   dem Content-Stream entfernen, nicht nur überdecken. Spike zeigt: Option A ist
   machbar (`spikes/t-001/BEFUND.md`, 14/14 Verifikationen grün, auch der
   Subset/CID-Fall). Offene Risiken vor Integration: `TJ`-Zeilen-Granularität
   (ganze Zeile in einem Operator) + Form-XObjects. Nächster Schritt: an echten
   Word-/Canva-/LibreOffice-Exporten gegentesten.
   → `docs/tickets/T-001-echte-redaktion.md`.
3. **Formularfelder** ausfüllen (AcroForm, pdf-lib `getForm()`) — bewusst *später*.
4. **Single-File-Build**: eine `index.html` für USB / `file://` ohne Server
   (braucht Inlinen des pdf.js-Workers **und** der WASM-Assets).

## Bekannte Grenzen
- **„Text korrigieren"** nur auf echten Text (keine Scans) und **0°-Seiten**;
  Ersatzschrift bei nicht gebündelter Familie → Badge „angenähert"; kein
  seitenübergreifender Reflow. Absatzerkennung erkennt keine zentrierten
  Absätze und keinen Erstzeilen-Einzug (bleiben Einzeilen-Blöcke).
- **Weissfläche/Korrektur überdeckt nur optisch** — Originaltext bleibt im
  Text-Layer auslesbar (→ Ticket T-001).
- **Service-Worker brauchen HTTPS** (oder localhost). GitHub Pages ✓. Reiner
  HTTP-Schulserver ⇒ SW inaktiv, App nur online (→ dann Single-File-Build).
- **Offline-Persistenz hängt an der Gerätepolitik der Schule**: setzen die
  Acer-Geräte das Browserprofil bei Logout/Neustart zurück, ist der Cache weg —
  unabhängig von unserer App. Noch nicht an einem echten Schulgerät getestet.
- Ein Font (Helvetica) für **freien** Text; Text-Baseline WYSIWYG-nah.

## Offen / optional
- Schülermaterial (`unterricht/`) zusätzlich online stellen — dazu Dateien nach
  `public/` verschieben, dann per `.../pdf-siebesiech/anleitung.html` erreichbar.
- Gebündelte Fonts (`public/fonts/`, ~8.5 MB) sind lazy-geladen → keine Grundlast;
  bei Bedarf weitere Familien ergänzen.

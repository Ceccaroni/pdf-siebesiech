# STATUS — PDF-Siebesiech

_Aktualisiert: 2026-09-17_

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
Decoder-Fix). **Auto-Update:** neue App-Versionen laden sich automatisch neu
(datenverlustsicher, `src/lib/appUpdate.ts`) — live. Details zu allem: ARCHIV.md.

**🔴 Offen:** In **Safari (macOS)** rendert die App Bewerbungs-PDFs (noch) weiss —
Diagnose läuft, siehe Nächste Schritte #1. Chrome/Edge & Windows-Schulgeräte nicht
betroffen.

**Läuft:** Öffnen (Klick / Drop) · Miniaturleiste (DnD, Mehrfachauswahl, drehen /
löschen / duplizieren) · Multi-Dokument (Merge, Herkunftsfarben) · Zoom ·
Editor (Text · Weissfläche · Text korrigieren **in Absätzen**, Originalschrift)
· Export + Split · PWA/Offline · „Über"-Dialog · Schülermaterial (`unterricht/`).

## Nächste Schritte
1. **🔴 Safari zeigt Bewerbungs-PDFs weiss (offen, Diagnose läuft).** Auf dem Mac
   (Safari 26) rendert die App bei Bewerbungs-PDFs **weisse Miniaturen + Vorschau**,
   obwohl „4 Seiten" korrekt erkannt wird (pdf.js *parst* also). Betrifft zwei
   grundverschiedene Dateien (Canva-Export **und** per `build.py` aus HTML erzeugte)
   → kein Datei-Problem. **Chrome/Edge ok; Windows-Schulgeräte nicht betroffen**
   (kein Safari). Belegt: Datei intakt (Quartz/poppler/pdf.js), und der **legacy**-
   pdf.js-Build rendert dieselbe Datei im **echten** Safari korrekt (Diagnose v1:
   „beide gerendert"). Verdacht: die App nutzt den **modern**-Build (Vite-Default von
   `pdfjs-dist`) — oder der **Blob→`<img>`**-Anzeigepfad. **Nächster Schritt:**
   serverlose Diagnose `~/Downloads/PDF-Siebesiech-Safari-Diagnose.html` im Safari
   des Nutzers auswerten (Test **Ⓜ** modern-Build vs. **🖼** Blob→img, bei Retina-dpr)
   → das leere von beiden ist die Ursache. Fix dann entweder App auf **legacy-Build**
   umstellen (Vite-Alias `pdfjs-dist` → `legacy/build/pdf.mjs` + legacy-Worker) **oder**
   Anzeige-Pfad ändern; danach an Safari verifizieren + deployen.
   _Repro-Werkzeuge in diesem Scratchpad: `safari-diag/` (Seiten v1/v2 + `serve.py`),
   `build_selfcontained.py`; Playwright (Python) mit chromium/webkit installiert._
2. **Browser-Gegencheck der Vorschau** (weiterhin offen): Export ist end-to-end
   validiert (Node/Playwright), aber das **visuelle Editor-Erlebnis** wurde nie
   live im eigenen Dev-Server geprüft — insbesondere die neue Absatz-Korrektur
   (Textarea-Auto-Höhe, Grundlinien-Optik bei echten Mehrzeilern) und generell
   Motischreiben/Stift/Datumszeile. `npm run dev` → einmal alle Werkzeuge durchklicken.
3. **T-001 — Echte Redaktion** (vom Nutzer gewünscht): Originaltext wirklich aus
   dem Content-Stream entfernen, nicht nur überdecken. Spike zeigt: Option A ist
   machbar (`spikes/t-001/BEFUND.md`, 14/14 Verifikationen grün, auch der
   Subset/CID-Fall). Offene Risiken vor Integration: `TJ`-Zeilen-Granularität
   (ganze Zeile in einem Operator) + Form-XObjects. Nächster Schritt: an echten
   Word-/Canva-/LibreOffice-Exporten gegentesten.
   → `docs/tickets/T-001-echte-redaktion.md`.
4. **Formularfelder** ausfüllen (AcroForm, pdf-lib `getForm()`) — bewusst *später*.
5. **Single-File-Build**: eine `index.html` für USB / `file://` ohne Server
   (braucht Inlinen des pdf.js-Workers **und** der WASM-Assets).

## Bekannte Grenzen
- **Safari (macOS): Bewerbungs-PDFs rendern (noch) weiss** — Ursache in Diagnose
  (siehe Nächste Schritte #1), Umgehung Chrome/Edge. Windows-Schulgeräte nicht
  betroffen. Datei & Export sind nachweislich intakt.
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

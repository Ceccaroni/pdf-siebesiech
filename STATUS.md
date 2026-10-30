# STATUS — PDF-Siebesiech

_Aktualisiert: 2026-10-30_

## 🚀 LIVE
- **App online:** https://ceccaroni.github.io/pdf-siebesiech/ (HTTPS, verifiziert).
- **Deploy:** GitHub Pages via Actions — jeder Push auf `main` geht automatisch live.
  Repo: `Ceccaroni/pdf-siebesiech` (public).
- Erster Schuleinsatz (Merge/Split) lief; ein Live-Bug wurde während der Stunde
  gemeldet und noch am selben Tag behoben + deployt (siehe ARCHIV.md, 2026-08-13
  „Fix: gescannte Dokumente").

## Stand
Phase 1, 2a, 2b, 2c fertig & live. **Freitext-Werkzeug („T") repariert:** war in
Produktion nie nutzbar (programmatischer Fokus wurde von der Klick-Standard-
Fokusbehandlung sofort entzogen → leeres Feld löschte sich selbst). Fix via
`requestAnimationFrame`; Textfelder jetzt am Körper ziehbar + sichtbare
„Verschieben"-Leiste (`src/components/PageEditor.tsx`). **Formularfelder
ausfüllbar (NEU):** Werkzeug „Formular" erkennt AcroForm-Text-/Checkbox-Felder
(pdf.js) und legt Eingabe-Overlays darüber; Export füllt + flacht pro Quelle VOR
`copyPages` ein (`getPageFormFields` in `pdfEngine.ts`, `applyFormFills` in
`exportPdf.ts`). **„Text korrigieren" gruppiert Absätze** statt Einzelzeilen.
**Gescannte Dokumente (JBIG2)** rendern korrekt (WASM-Decoder-Fix). **Auto-
Update** live. Beide neuen Editor-Features via Playwright gegen den Prod-Build
verifiziert (Chromium). Details: ARCHIV.md.

**🔴 Offen:** In **Safari (macOS)** rendert die App Bewerbungs-PDFs (noch) weiss —
Diagnose läuft, siehe Nächste Schritte #1. Chrome/Edge & Windows-Schulgeräte nicht
betroffen.

**Läuft:** Öffnen (Klick / Drop) · Miniaturleiste (DnD, Mehrfachauswahl, drehen /
löschen / duplizieren) · Multi-Dokument (Merge, Herkunftsfarben) · Zoom ·
Editor (Text platzieren **& ziehen** · Weissfläche · Text korrigieren **in
Absätzen**, Originalschrift · **Formular ausfüllen**) · Export + Split ·
PWA/Offline · „Über"-Dialog · Schülermaterial (`unterricht/`).

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
2. **Browser-Gegencheck der Vorschau** (teilweise erledigt): Text-Werkzeug,
   Körper-Ziehen, Formular-Ausfüllen + Text-Korrektur sind jetzt via Playwright
   gegen den Prod-Build geprüft (Chromium). **Offen:** manuelle Sichtprüfung am
   echten Gerät (v.a. Safari — siehe #1) und Feintuning Grundlinien-Optik bei
   echten Mehrzeilern.
3. **T-001 — Echte Redaktion** (vom Nutzer gewünscht): Originaltext wirklich aus
   dem Content-Stream entfernen, nicht nur überdecken. Spike zeigt: Option A ist
   machbar (`spikes/t-001/BEFUND.md`, 14/14 Verifikationen grün, auch der
   Subset/CID-Fall). Offene Risiken vor Integration: `TJ`-Zeilen-Granularität
   (ganze Zeile in einem Operator) + Form-XObjects. Nächster Schritt: an echten
   Word-/Canva-/LibreOffice-Exporten gegentesten.
   → `docs/tickets/T-001-echte-redaktion.md`.
4. **Formularfelder ausfüllen — ERLEDIGT (Basis).** AcroForm-Text- & Checkbox-
   Felder werden erkannt (pdf.js) und ausgefüllt; Export via fill+`flatten()` vor
   `copyPages`. **Offen/optional:** Radiobuttons & Auswahllisten (Dropdowns),
   Bearbeitung auch auf gedrehten Seiten, Option „interaktiv lassen statt flach".
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
- **Formular ausfüllen:** nur Text- & Checkbox-Felder (Radio/Dropdown noch
  nicht); nur auf 0°-Seiten; der Export flacht das Formular ein → Ausgabe ist
  nicht mehr interaktiv (bewusst, fürs Abgeben/Drucken). Vorbefüllte Werte
  bleiben erhalten. pdf.js rendert vorhandene Feldwerte ins Seitenbild → die
  Overlays sind deckend, damit nichts doppelt erscheint.
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

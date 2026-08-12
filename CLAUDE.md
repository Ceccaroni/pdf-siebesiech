# CLAUDE.md — PDF-Siebesiech

Browser-basierte PDF-App für ein **Schulumfeld mit gesperrten Geräten**
(Acer TravelMate B, Win 11). SuS können nichts installieren → alles läuft
clientseitig im Browser: keine Installation, keine Adminrechte, nichts wird
hochgeladen.

## Rituale (immer einhalten)
- **Session-Start:** `/start` — STATUS.md lesen, Stand + nächsten Schritt melden.
- **Session-Ende:** `/ende` — STATUS.md aktualisieren, Erledigtes → ARCHIV.md, Fazit.

## Stack (bewusst gewählt)
- React + TS + Vite (statischer Build, kein Server)
- **pdf.js** (Apache-2.0) rendern · **pdf-lib** (MIT) Struktur/Export · **@dnd-kit** · Tailwind
- **Kein mupdf.js** (AGPL + 10 MB WASM zu schwer für die Geräte)

## Befehle
- `npm run dev` · `npm run build` · `npm run preview`
- Test-PDF erzeugen: `node samples/generate.mjs`

## Architektur-Kern
- Modell: Original-Bytes **unverändert** + Seiten-Deskriptoren
  `{docId, sourceIndex, rotation}` + Anmerkungen (`text` / `whiteout`,
  normalisierte Koordinaten 0..1 ab **oben links**).
- Rendern (pdf.js) und Zusammenbauen/Export (pdf-lib) strikt **getrennt**.
- Immer **frisches Canvas** pro Render (kein geteiltes Canvas → sonst
  pdf.js-Fehler „same canvas" → weisse Seiten).

## Konventionen
- Sprache: Deutsch, Schweizer **«ss»** statt «ß»; UI-Texte auf Deutsch.
- „Text bearbeiten" = **Redigieren-und-Neusetzen** (Weissfläche + Textfeld),
  kein Fließtext-Reflow.
- Aktueller Stand: **STATUS.md** · Historie: **ARCHIV.md**.

# T-001 Spike — Befund: Content-Stream-Chirurgie (Option A)

_R&D-Spike, 2026-08-12. Ziel: prüfen, ob sich ein einzelner Text-Lauf **wirklich**
aus dem Content-Stream entfernen lässt (nicht nur überdecken) — clientseitig,
ohne AGPL/mupdf, auf schwacher Hardware. Bezug: `docs/tickets/T-001-echte-redaktion.md`._

## Aufbau

- `surgery.mjs` — der Chirurg: Content-Streams dekomprimieren (Flate) →
  eigener Operator-Tokenizer → Ziel-`Tj`/`TJ` über **Position (Tm/Td) + optional Text**
  finden → Show-Operator herausschneiden → neu (Flate-)kodieren. Nur **pdf-lib + Flate**
  (Node `zlib`; im Browser → `pako`/`DecompressionStream`) — browser-portabel.
- `make-hard-case.mjs` — erzeugt den schwierigen Fall: eingebetteter, **gesubsetteter**
  Carlito (~Calibri) → Type0/CIDFontType2, Identity-H → Text als **Glyph-IDs** im Stream.
- `verify.mjs` — Harness: fährt 3 Szenarien, prüft mit externem `pdftotext` (Extraktion)
  und `qpdf --check` (Validität). `pdftotext`/`qpdf` sind reine **Test**-Tools, keine App-Abhängigkeit.

Ausführen: `SCRATCH=/tmp node spikes/t-001/verify.mjs`

## Ergebnis: 14/14 Assertions grün

- **einfach** (pdf-lib/StandardFont, Klartext-String): Ziel weg, Rest bleibt echter Text, valide.
- **schwer** (Subset/CID, Glyph-IDs — Text NICHT im Klartext): via **Positions-Match**
  entfernt, Rest bleibt, valide.
- **mehrfach**: zwei Ziele selektiv entfernt, Nachbarläufe unberührt, valide.

→ Der überdeckte Text ist nach der Chirurgie **nicht mehr per `pdftotext`/Copy-Paste
extrahierbar** (Akzeptanzkriterium 1), der Rest bleibt echter, durchsuchbarer Text
(Kriterium 2). Läuft rein clientseitig-portabel (Kriterium 3).

## Zentrale Erkenntnis

Bei Subset-/CID-Fonts steht im Content-Stream **kein lesbarer Text**, nur Glyph-IDs
(`<0001000200…> Tj`). Ein Text-Match scheitert dort prinzipiell. **Die Position (`Tm`/`Td`)
ist der zuverlässige Schlüssel** — und genau die liefert `getPageTextRuns` (pdf.js)
im Browser zusammen mit dem bereits entschlüsselten Text. Die Korrelation Lauf→Operator
läuft also über die Baseline-Position; der Text-Match ist nur Zusatzabsicherung, wenn
der Stream-String lesbar ist.

## Noch offene Risiken (nicht im Spike abgedeckt)

1. **Granularität = ein Show-Operator (wichtigste offene Frage).** Echte Office-/Canva-/
   InDesign-Exporte legen oft eine **ganze Zeile in einen `TJ`** (mit Kerning-Zahlen).
   Klickt der Nutzer ein einzelnes Wort an, entfernt das Löschen des `TJ` die **ganze
   Zeile**. Für Formulardaten (Name/Adresse/Note) meist sogar erwünscht — aber nicht
   immer. Präzise Variante: nur die betroffenen Glyphen aus dem `TJ`-Array schneiden
   (aufwändiger). **Zu testen:** wie splittet pdf.js `getTextContent` einen Zeilen-`TJ`
   in anklickbare Läufe, und trifft deren Position noch die `Tm`-Startposition?
2. **Form-XObjects.** Text kann in einem `/XObject`-Stream stecken statt im Seiten-
   Content-Stream (häufig bei Canva/InDesign). Dann muss die Chirurgie **rekursiv** in
   XObjects greifen — noch nicht implementiert.
3. **Text-Matrix mit Skalierung/Rotation & `cm`.** Das Positions-Tracking nimmt nur
   `e,f` aus `Tm`/`Td` und ignoriert `a,b,c,d` sowie die CTM (`cm`). Für 0°-Seiten mit
   identischer Skalierung (Ticket-Rahmen) ok; gedrehte/skalierte Textläufe = Randfall.
4. **Folge-Positionierung.** Ein entfernter `TJ` rückt theoretisch die Textposition
   nachfolgender Operatoren nicht mehr vor. Unkritisch, solange jeder Lauf ein eigenes
   `Tm`/`Td` hat (Regelfall) — sonst Advance kompensieren.
5. **Subset behält die Glyphe im `FontFile2`.** Ohne Content-Referenz unsichtbar & nicht
   extrahierbar; forensische Font-Bereinigung ist explizites **Nicht-Ziel**.

## Empfehlung

Option A ist tragfähig und der Kern-Algorithmus steht. Nächster sinnvoller Schritt vor
Integration: **Risiko 1 + 2 an echten Fremd-PDFs** (ein Word-, ein Canva-, ein
LibreOffice-Export) gegentesten — insbesondere das `TJ`-Zeilen-/XObject-Verhalten.
Danach Portierung des Kerns nach `src/lib/` (Flate via `pako`/`DecompressionStream`)
und Verdrahtung mit `getPageTextRuns` + einem UI-Schalter „sicher entfernen".

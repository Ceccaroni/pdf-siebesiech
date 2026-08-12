# PDF-Siebesiech

Eine PDF-App, die **komplett im Browser** läuft — PDFs öffnen, Seiten per
Drag & Drop ordnen (Miniaturleiste wie in macOS Vorschau), drehen, löschen,
duplizieren und als neues PDF speichern. **Ohne Installation, ohne Server,
ohne Adminrechte** — gedacht für gesperrte Schul-Notebooks (z. B. Acer
TravelMate B).

> Alle Daten bleiben auf dem Gerät. Es wird nichts hochgeladen.

## Warum eine Browser-App statt einer .exe?

Gesperrte Schulgeräte blockieren typischerweise Installationen und das
Ausführen von `.exe` (AppLocker / SmartScreen / Gruppenrichtlinien). Ein
**Browser (Edge) ist aber immer vorhanden**. Darum ist PDF-Siebesiech eine
statische Web-App: Sie braucht keinerlei Installation und rechnet zu 100 %
clientseitig.

## Funktionen (Phase 1)

- 📄 PDF öffnen per Knopf **oder** Datei ins Fenster ziehen (mehrere gleichzeitig)
- 🖱️ **Apple-artige Miniaturleiste**: Seiten per Drag & Drop umsortieren
- 🔢 Mehrfachauswahl (Klick, ⌘/Strg-Klick, ⇧-Klick) und Block-Verschiebung
- 🔄 Drehen (links/rechts), 🗑️ Löschen, ⧉ Duplizieren
- 🔍 Hauptansicht mit Zoom
- ✍️ **Text bearbeiten**: Textfelder hinzufügen (Grösse/Farbe), verschieben
- ⬜ **Weissfläche**: bestehenden Inhalt abdecken → zusammen ergibt das
  „bestehenden Text ersetzen" (Redigieren-und-Neusetzen)
- 💾 Export als neues, bearbeitetes PDF

### Text bearbeiten (Redigieren-und-Neusetzen)

Echtes Fließtext-Reflow-Editing beliebiger PDFs kann keine freie Bibliothek
zuverlässig. PDF-Siebesiech nutzt den Profi-Standard: mit **Weissfläche** den
alten Text abdecken, mit dem **Text-Werkzeug** neuen Text darüberlegen. Alle
Anmerkungen werden beim Export real ins PDF gezeichnet (pdf-lib `drawRectangle` /
`drawText`). Bearbeiten geht auf ungedrehten Seiten (0°).

### Tastenkürzel (in der Miniaturleiste)

| Taste | Aktion |
|---|---|
| ↑ / ↓ | Seite wechseln (mit ⇧ Auswahl erweitern) |
| ⌘/Strg + A | Alle auswählen |
| ⌘/Strg + D | Auswahl duplizieren |
| ⌫ / Entf | Auswahl löschen |
| `[` / `]` | Auswahl links/rechts drehen |

## Technik

| Baustein | Wahl | Lizenz |
|---|---|---|
| UI / Build | React + TypeScript + Vite | MIT |
| Rendern | **pdf.js** (`pdfjs-dist`) | Apache-2.0 |
| Struktur/Export | **pdf-lib** | MIT |
| Drag & Drop | **@dnd-kit** | MIT |
| Styling | Tailwind CSS | MIT |

Bewusst **kein mupdf.js**: Das ist AGPL-3.0 (Copyleft-Pflicht beim Hosten) und
lädt ~10 MB WASM — auf schwacher Schul-Hardware zu schwer. pdf.js ist leicht,
permissiv und für genau solche Geräte optimiert.

### Datenmodell

Die Original-Bytes jedes PDFs bleiben unangetastet. Das Arbeitsdokument ist eine
Liste von **Seiten-Deskriptoren** (`{ docId, sourceIndex, rotation }`).
Umsortieren, Löschen, Duplizieren und Drehen verändern nur diese Liste; beim
Export baut pdf-lib daraus ein neues PDF (`copyPages` + `setRotation`). Das hält
Rendern (pdf.js) und Bearbeiten (pdf-lib) sauber getrennt.

## Entwicklung

```bash
npm install
npm run dev      # Dev-Server (http://localhost:5173)
npm run build    # Prod-Build nach dist/
npm run preview  # Prod-Build lokal ansehen
```

Beispiel-PDF zum Testen: `node samples/generate.mjs` → `samples/beispiel.pdf`.

## Verteilung an die Schule

**Empfohlen — gehostet:** `npm run build`, dann den `dist/`-Ordner auf einen
Webserver oder GitHub Pages legen. Die SuS öffnen eine URL. Über Edge lässt sich
die Seite als App „installieren" (auch ohne Adminrechte). Basis-Pfad ist relativ
(`base: './'`), läuft also auch in einem Unterordner.

**Portabel (Fallback):** Ein Single-File-Build (WASM eingebettet) für USB /
Netzlaufwerk ist als Phase-2-Ausbau geplant. `file://` + WASM ist heikel, daher
ist Hosting der robustere Weg.

## Roadmap

**Phase 2a — erledigt:** ✍️ Text hinzufügen/bearbeiten + ⬜ Weissfläche
(Redigieren-und-Neusetzen), Editor mit Overlay.

**Phase 2b — offen:**
- 🧾 Formularfelder ausfüllen
- 🔗 Seiten zwischen mehreren Dokumenten ziehen, Merge / Split
- 📴 PWA / Service-Worker für echten Offline-Betrieb + Single-File-Build
- 🔎 Optional: bestehenden Text anklickbar machen (pdf.js `getTextContent` →
  Auto-Whiteout + Neusetzen an gleicher Stelle)

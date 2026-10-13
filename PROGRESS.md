# Fortschritt

Stand der Phasen aus `SPEC.md`, Abschnitt 10. Pro Phase: Plan vor Beginn, Ergebnis der Abnahme danach.

| Phase | Titel | Status |
|---|---|---|
| 0 | Fundament und Unity-Layout | in Arbeit |
| 1 | Objekte, Komponenten, Block-Skripte, Play-Modus | offen |
| 2 | Projekt-Fenster, Asset-Bibliothek, Prefabs | offen |
| 3 | Spieler, Physik, Animation | offen |
| 3b | Figuren-Studio | offen |
| 4 | Umgebung und Grafik | offen |
| 5 | NPCs und Spiellogik | offen |
| 6 | UI, Menüs, Speichern | offen |
| 7 | Grosse Projekte | offen |
| 8 | Debugging | offen |
| 9 | Build und Export | offen |
| 10 | KI-Assistent | offen |
| 11 | Feinschliff und Endabnahme | offen |

---

## Phase 0: Fundament und Unity-Layout

### Plan

**Teilaufgaben**

1. **Monorepo-Gerüst**
   - pnpm-Workspace mit `packages/*` und `apps/*`, Node LTS (`.nvmrc`), TypeScript strict (`tsconfig.base.json`).
   - ESLint (Flat Config, `typescript-eslint`, `no-explicit-any` als Fehler, Importverbot Blockly/`apps` in `packages/runtime`, keine Textliterale in JSX), Prettier (LF, 2 Leerzeichen), `.gitattributes` mit LF.
   - Vitest mit einem Projekt pro Paket, Playwright für Browser und Electron.
   - Skripte: `pnpm dev`, `pnpm dev:desktop`, `pnpm test`, `pnpm test:e2e`, `pnpm lint`, `pnpm build`.
   - Pakete nach `CLAUDE.md`: `blocks`, `compiler`, `runtime` mit Inhalt; `project`, `library`, `character` als leere Gerüste für spätere Phasen.
2. **Editor-Hülle** (`apps/editor`, React + Vite + Zustand + `dockview`)
   - Menüleiste (Datei, Bearbeiten, Assets, Objekt, Komponente, Fenster, Hilfe), Werkzeugleiste (Hand/Verschieben/Drehen/Skalieren/Rechteck/Kombi mit `Q`–`Y`, Pivot/Mitte, Lokal/Global, Play/Pause/Einzelbild, Ebenen, Layout).
   - Bereichs-Reiter (Alle, Umgebung, Spieler 1, Spieler 2, NPCs, Gegenstände, UI, +) mit `Alt+1` … `Alt+9`.
   - Andockbare Fenster: Hierarchie, Szene, Spiel, Block-Editor, Inspektor, Projekt, Asset-Bibliothek, Konsole. Verschieben, als Reiter gruppieren, schwebend lösen und in ein eigenes Fenster abtrennen.
   - Layouts: automatische Speicherung des aktuellen Layouts, Vorlagen „Standard“ und „Blöcke gross“, eigene Layouts speichern, laden, löschen. `Strg+1` … `Strg+5` fokussiert Fenster.
   - i18n Deutsch/Englisch über JSON-Dateien, Umschaltung im Menü, Test auf vollständige Schlüssel in beiden Sprachen. Dunkles Design als Standard, helles wählbar.
3. **Szenen-Ansicht** (`packages/runtime` + `apps/editor`)
   - Laufzeit: Renderer (WebGL2, ACES-Tone-Mapping, sRGB), Umgebung aus berechnetem Himmel mit Sonnenstand, Umgebungslicht aus dem Himmel, Sonne mit weichen Schatten, texturierter Boden, Nebel in der Ferne.
   - Standardszene im Editor: Hauptkamera, Sonne, Boden, Testwürfel. Hierarchie zeigt sie, Auswahl per Klick in Hierarchie oder Szene, Inspektor zeigt Name und Transform (nur lesend, Bearbeiten kommt in Phase 1).
   - Unity-Kamerasteuerung: rechte Maustaste + WASD fliegen, Q/E runter/hoch, Shift schneller, Mausrad während des Fliegens ändert Tempo; Alt + linke Maustaste umkreisen; mittlere Maustaste oder Hand-Werkzeug verschieben; Mausrad zoomen; `F` und Doppelklick in der Hierarchie fokussieren (weich animiert).
   - Achsenwürfel oben rechts: Klick auf Achse → Ansicht von dieser Seite, Klick auf die Beschriftung → perspektivisch/orthografisch.
   - Editor-Raster (unendlich, blendet aus), Auswahlrahmen. Spiel-Ansicht rendert aus der Hauptkamera mit Statistik (Bildzeit, Draw Calls, Dreiecke).
4. **Blöcke**
   - `defineBlock` in `packages/blocks` als einzige Quelle, daraus Blockly-JSON, Toolbox pro Bereich (passende Kategorien zuerst) und Suchwörter.
   - Testblöcke: „Wenn Spiel startet“ (Hut) und „gehe ( ) Meter vorwärts“ (Stapel, Beispiel aus SPEC 7.10).
   - Minimaler Compiler (Block-JSON → Zwischenrepräsentation → JavaScript-Generator-Funktionen nach Anhang B). Die Zwischenrepräsentation enthält schon Funktionen mit Rückgabewert und lokale Variablen.
   - Golden-Test und Laufzeittest für jede neue Blockart.
   - Blockly im Block-Editor mit Sprachumschaltung (Blockly-Texte und eigene Blocktexte), Kopfzeile mit Skript und Objekt.
5. **Electron-Hülle** (`apps/desktop`): Hauptprozess, Preload mit Kontext-Isolation, abgetrennte Fenster erlaubt, `pnpm dev:desktop` startet Vite und Electron.
6. **GitHub-Grundlage**: `README.md`-Gerüst, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md` (Contributor Covenant 2.1), `SECURITY.md`, `CHANGELOG.md`, `THIRD_PARTY.md` (mit Lizenzprüfung als Skript), Issue-Vorlagen (Fehler, Idee, neuer Block, neues Asset-Paket), PR-Vorlage mit Checkliste, `ci.yml` (Lint, Typprüfung, Tests, Build, Playwright mit Screenshots als Artefakt, Windows und Linux).
7. **Abnahme**: alle Kriterien prüfen, Screenshot nach `docs/screenshots/phase-00.png`, Ergebnis hier eintragen, Pull Request.

**Betroffene Pakete:** alle (Neuanlage). Inhalt in `blocks`, `compiler`, `runtime`, `apps/editor`, `apps/desktop`.

**Risiken**

- WebGL in Headless-Chromium und Electron ohne GPU (CI, Container): Playwright mit SwiftShader starten. Leistung dort nicht aussagekräftig, nur Funktion.
- Abgetrennte Fenster (Popout) mit WebGL-Canvas und Blockly: Beide hängen am Dokument des Hauptfensters. Muss im Browser und in Electron geprüft werden.
- Electron unter Linux-CI braucht `xvfb` und `--no-sandbox` (AppArmor auf Ubuntu-Runnern).
- Gespeicherte Layouts mit abgetrennten Fenstern dürfen beim Start keine Popups erzwingen (Popup-Blocker).
- Versionssprünge der Abhängigkeiten seit Stand des Modellwissens: APIs von `dockview`, `blockly`, `three`, `vitest` beim Einbau gegen die installierten Typen prüfen.

### Annahmen

- **Branch:** Phase 0 wird auf dem Branch `claude/new-session-k687n4` entwickelt statt auf `phase/00-fundament`. Die Cloud-Sitzung darf nur auf diesen Branch pushen. Der Nutzer hat die Wahl freigestellt.
- **Beispielprojekt Phase 0:** Das Projektformat kommt erst in Phase 1, einen Play-Modus gibt es in Phase 0 noch nicht. Als „Beispielszene“ dient die Standardszene des Editors (Himmel, Sonne, Boden, Testwürfel). `examples/` bekommt ab Phase 1 echte Projekte.
- **Standardszene ohne Projektdatei:** Die Objekte der Standardszene leben in Phase 0 nur im Speicher. Ihre Namen kommen aus den i18n-Dateien. Ab Phase 1 sind Objektnamen Projektdaten.
- **Layouts** sind Benutzereinstellungen und kein Teil des Projekts (wie in Unity). Sie liegen im `localStorage` des Editors (in Electron im Benutzerordner) und überstehen Neustarts.
- **KI-Knopf** in der Werkzeugleiste bleibt unsichtbar, solange kein API-Schlüssel hinterlegt ist (SPEC 9.4: „Ohne Schlüssel ist nichts davon sichtbar“).
- **Play, Pause, Einzelbild** sind in Phase 0 sichtbar, aber deaktiviert. Der Play-Modus kommt in Phase 1.
- **Laufrichtung:** „vorwärts“ ist lokal +Z (wie im Beispiel in SPEC 7.10 und in der glTF-Konvention). Wie links/rechts auf die X-Achse abgebildet werden, wird vor Phase 1 bestätigt (Koordinatensystem).
- **Electron-Menü:** Die Menüleiste ist Teil der Editor-Oberfläche (gleich in Browser und Desktop). Das native Electron-Menü ist ausgeblendet.
- **Icons:** eigene, neutrale Symbole aus `lucide-react` (ISC), keine Unity- oder Scratch-Grafiken.

### Ergebnis

_Wird nach der Abnahme eingetragen._

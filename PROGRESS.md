# Fortschritt

Stand der Phasen aus `SPEC.md`, Abschnitt 10. Pro Phase: Plan vor Beginn, Ergebnis der Abnahme danach.

| Phase | Titel | Status |
|---|---|---|
| 0 | Fundament und Unity-Layout | abgeschlossen |
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
- **Koordinatensystem (vom Nutzer bestätigt):** Y oben, 1 Einheit = 1 Meter, „vorwärts“ ist lokal +Z (wie SPEC 7.10 und glTF), „rechts“ ist lokal −X.
- **Electron-Menü:** Die Menüleiste ist Teil der Editor-Oberfläche (gleich in Browser und Desktop). Das native Electron-Menü ist ausgeblendet.
- **Icons:** eigene, neutrale Symbole aus `lucide-react` (ISC), keine Unity- oder Scratch-Grafiken.

- **Repository-Dokumente auf Englisch:** `README.md` hat eine deutsche Hauptbeschreibung mit englischer Kurzfassung; `CONTRIBUTING.md`, `SECURITY.md`, `CHANGELOG.md` sind wie Code und Commits auf Englisch. `PROGRESS.md` bleibt Deutsch (Bericht an den Nutzer).
- **Lizenzen MIT-0 und 0BSD** gelten als Varianten von MIT bzw. BSD und sind erlaubt. `lru-cache` (BlueOak-1.0.0) kommt nur über Blockly → jsdom (Node.js) ins Projekt und ist nicht im Editor-Bundle; das ist in `THIRD_PARTY.md` als Ausnahme begründet.
- **Software-Rendering:** Die Electron-App weicht bei fehlender oder gesperrter GPU auf SwiftShader aus, damit die 3D-Ansichten immer laufen (nur lokale Inhalte, daher unbedenklich).
- **Playwright 1.56** statt der neuesten Version, weil die Cloud-Umgebung genau dieses Chromium vorinstalliert hat. Die CI installiert dieselbe Version.
- **ESLint 10 ohne `eslint-plugin-react`:** Die Regel „keine festen Texte in JSX“ ist eine kleine eigene Regel (`blockwerk/no-ui-literals`) in `eslint.config.js`.

### Ergebnis

**Umgesetzt**

- Monorepo mit `packages/blocks`, `compiler`, `runtime` (mit Inhalt) und `project`, `library`, `character` (Gerüste), `apps/editor`, `apps/desktop`. TypeScript strict, ESLint (inkl. Importgrenzen für `runtime`, `blocks`, `compiler`), Prettier, Vitest, Playwright, Lizenzprüfung.
- Editor im Unity-Standard-Layout: Menüleiste, Werkzeugleiste (Q W E R T Y, Pivot/Mitte, Lokal/Global, Play/Pause/Einzelbild deaktiviert, Ebenen, Layout), Bereichs-Reiter mit `Alt+1…9` und eigenen Reitern, andockbare Fenster Hierarchie, Szene, Spiel, Block-Editor, Inspektor, Projekt, Asset-Bibliothek, Konsole.
- Fenster verschieben, als Reiter gruppieren, schwebend lösen, in eigenes Fenster abtrennen (Browser und Electron). Layout wird automatisch gespeichert; Vorlagen „Standard“ und „Blöcke gross“; eigene Layouts speichern, laden, löschen; Fenster über „Fenster“ wieder öffnen; `Strg+1…5` fokussiert Fenster.
- Szenen-Ansicht: berechneter Himmel mit Wolken, Sonne mit weichen Schatten, Umgebungslicht aus dem Himmel, texturierter Boden, Nebel, Editor-Raster, Kamera- und Sonnen-Gizmo, Auswahl per Klick. Kamera wie Unity: rechte Maustaste + WASD/QE fliegen (Shift schneller, Mausrad = Tempo), Alt + links umkreisen, Alt + rechts zoomen, mittlere Maustaste oder Hand-Werkzeug verschieben, Mausrad zoomen, `F` und Doppelklick fokussieren. Achsenwürfel mit Achsenansichten und Perspektivisch/Orthografisch.
- Spiel-Ansicht aus der Hauptkamera mit Seitenverhältnis und Statistik (Bildzeit, Draw Calls, Dreiecke). Beispielszene: 4 Draw Calls, 38 Dreiecke.
- `defineBlock` als einzige Quelle; daraus Blockly-JSON, Palette pro Bereich, Suchindex. Testblöcke „Wenn Spiel startet“ und „gehe ( ) Meter vorwärts“. Compiler Block-JSON → Zwischenrepräsentation (mit Funktionen, Rückgabewerten, lokalen Variablen) → Generator-Funktionen mit Zeilen-zu-Block-Zuordnung. Golden- und Laufzeittests, die jede Katalog-Blockart erzwingen.
- Block-Editor mit Blockly (Zelos-Darstellung, Hut-Blöcke), Blockly-Medien lokal statt vom CDN. Blockly läuft in einer eigenen Seite (`blocks.html`) im Fenster, damit Ziehen, Palette und Zahlenfelder auch im schwebenden oder abgetrennten Fenster (zweiter Bildschirm) funktionieren.
- Deutsch/Englisch komplett über i18n-Dateien (Menüs, Fenster, Blöcke, Blockly), dunkles und helles Design.
- Electron-Hülle: Editor über `blockwerk://` mit Content-Security-Policy ohne Netzwerk, abgetrennte Fenster als Editor-Fenster, `pnpm dev:desktop`.
- GitHub-Grundlage: `README.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md` (Contributor Covenant 2.1), `SECURITY.md`, `CHANGELOG.md`, `THIRD_PARTY.md` (generiert und geprüft), Issue-Vorlagen (Fehler, Idee, neuer Block, Asset-Paket), PR-Vorlage, `ci.yml` für Windows und Linux.

**Abnahme**

- [x] `pnpm dev` und `pnpm dev:desktop` öffnen den Editor. `pnpm test` (59 Tests), `pnpm lint`, `pnpm build` grün.
- [x] Repository ist auf GitHub (öffentlich), die CI läuft dort auf Windows und Linux grün ([CI-Lauf](https://github.com/tmluc-cool/Blockwerk/actions/runs/38379593872)).
- [x] Fenster lassen sich verschieben, als Reiter gruppieren und abtrennen; Layout bleibt nach Neustart erhalten (E2E im Browser per Neuladen und in Electron per echtem Neustart der App).
- [x] Szenen-Kamera bedient sich wie in Unity: Fliegen, Umkreisen, Verschieben, Zoomen, Fokussieren (E2E-Tests).
- [x] Die leere Szene sieht ordentlich aus: Himmel, Licht, weicher Schatten eines Testwürfels (`docs/screenshots/phase-00.png`).

Tests: 59 Unit-/Golden-Tests (Vitest), 24 End-to-End-Tests (23 Browser, 1 Desktop-App mit Neustart). Ein Wächter in den E2E-Tests schlägt fehl, sobald der Editor eine Netzwerkanfrage ausserhalb von `localhost` macht.

**Offen / Hinweise für später**

- Play-Modus, Projektformat, echte Objekte und Inspektor-Bearbeitung kommen in Phase 1. Bis dahin sind Play/Pause/Einzelbild und viele Menüpunkte sichtbar, aber deaktiviert.
- GitHub Discussions ist im Repository noch nicht aktiviert (Link in den Issue-Vorlagen), Labels (`good first issue`, `block`, …) und der Schutz von `main` müssen in den Repository-Einstellungen angelegt werden.
- Die GitHub-Actions-Versionen (`@v4`) laufen noch mit einer Node-20-Hinweismeldung; beim nächsten CI-Umbau auf die aktuellen Hauptversionen anheben.

# Blockwerk – Projektregeln für Claude Code

Blockwerk (Arbeitstitel) ist eine Open-Source-3D-Game-Engine, die sich **wie Unity bedienen lässt**, bei der die Logik aber mit **Scratch-artigen Befehlsblöcken** gebaut wird. Endziel: Mit Blockwerk entsteht ein spielbares 3D-Spiel, das sich anfühlt, als wäre es in Unity gemacht. Die vollständige Spezifikation steht in `SPEC.md`. Lies sie komplett, bevor du irgendetwas baust.

## Leitlinie

- **Alles ausser der Logik ist an Unity angelehnt:** Fensteraufbau, Begriffe, Tastenkürzel, Komponentenmodell, Prefabs, Play-Modus, Arbeitsabläufe. Bei jeder offenen Frage ausserhalb der Logik: „Wie macht Unity das?“ und es so umsetzen, ausser `SPEC.md` Abschnitt 3 nennt eine Verbesserung.
- **Die Logik ist wie Scratch:** Block-Skripte sind Komponenten, die Blöcke kommen aus Blockly.
- Eigene Ergänzungen gegenüber Unity: Bereichs-Reiter, Testgelände, Figuren-Studio, Asset-Bibliothek mit CC0-Modellen.

## Arbeitsweise

1. **Immer nur eine Phase gleichzeitig** (Phasenplan in `SPEC.md`, Abschnitt 10; es gibt eine Phase 3b zwischen 3 und 4).
2. Jede Phase in einem eigenen Branch (`phase/03-spieler`). Vor Beginn den Plan für die Phase in `PROGRESS.md` schreiben (Teilaufgaben, betroffene Pakete, Risiken). Dann umsetzen.
3. Nach jeder Phase: **alle Abnahmekriterien** prüfen (Tests + Beispielprojekt in `examples/`). Mit Playwright einen Screenshot der Beispielszene nach `docs/screenshots/phase-XX.png` speichern. Ergebnis in `PROGRESS.md` eintragen, Pull Request mit der Abnahme-Checkliste und dem Screenshot öffnen, dann anhalten und dem Nutzer kurz berichten: was fertig ist, wie man es ausprobiert, was offen ist.
4. Eine Phase gilt nur als fertig, wenn `pnpm test` lokal und die CI auf GitHub grün sind und das Beispielprojekt im Play-Modus läuft.
5. Wenn `SPEC.md` etwas offen lässt: sinnvolle Annahme treffen, in `PROGRESS.md` unter „Annahmen“ notieren, weiterarbeiten. Nur bei Entscheidungen, die sich später schwer ändern lassen (Projektdateiformat, Laufzeitmodell, Koordinatensystem, Standard-Skelett), zuerst nachfragen.
6. Kleine, thematische Commits (Conventional Commits, z. B. `feat(runtime): add third-person camera`). Daraus wird der Changelog erzeugt.

## Tech-Stack

- Sprache: TypeScript (strict), Node LTS, pnpm-Workspaces
- Editor: React + Vite + Zustand, andockbare Fenster (Docking-Layout-Bibliothek, z. B. `dockview`), Blockly (Apache-2.0) für die Blöcke
- 3D: Three.js (WebGL2), `postprocessing`, `three-mesh-bvh`
- Figuren: Three.js-Lader (GLTF, FBX, OBJ), `@pixiv/three-vrm`, Retargeting auf ein Standard-Skelett nach VRM-Knochennamen
- Physik: Rapier3D (`@dimforge/rapier3d-compat`, WASM), inklusive `KinematicCharacterController`
- NPC-Navigation: `recast-navigation` + `@recast-navigation/three`
- Asset-Pipeline: `@gltf-transform` (GLB optimieren, Meshopt, Texturen komprimieren)
- Desktop: Electron, Installer über `electron-builder`
- Tests: Vitest (Unit, Golden-Tests), Playwright (End-to-End, Screenshots)
- GitHub: Actions für CI, Releases und Pages

Lizenz jeder neuen Abhängigkeit prüfen und in `THIRD_PARTY.md` eintragen. Nur MIT, Apache-2.0, BSD, ISC, Zlib oder CC0. Das Projekt selbst steht unter MIT.

## Repo-Struktur

```
packages/blocks     Einzige Quelle aller Blockdefinitionen (Form, Eingaben, Typen, Texte, Codegen)
packages/compiler   Block-JSON → Zwischenrepräsentation → JavaScript (reine Funktionen)
packages/runtime    3D-Spiel-Engine und Komponenten, ohne jede Abhängigkeit vom Editor
packages/project    Projektformat, Meta-Dateien, Schema (zod), Laden/Speichern, Migrationen
packages/library    Asset-Bibliothek: Quellbeschreibungen, Index, Lizenzen, Build-Skripte
packages/character  Standard-Skelett, Skelett-Zuordnung, Retargeting, Baukasten-Logik
apps/editor         Editor-Oberfläche (läuft im Browser und in Electron)
apps/desktop        Electron-Hülle und Installer
examples/           Ein Beispielprojekt pro Phase, dient als Abnahmetest
docs/               Doku-Quellen, Screenshots, GitHub-Pages-Seite
library/            Heruntergeladene, optimierte Assets (in .gitignore, per Skript erzeugt)
.github/            Workflows (ci, release, pages), Issue- und PR-Vorlagen
```

## Befehle

```
pnpm install
pnpm assets:fetch   # Startpaket der Asset-Bibliothek laden, optimieren, Vorschaubilder rendern
pnpm dev            # Editor im Browser
pnpm dev:desktop    # Editor in Electron
pnpm test           # alle Unit- und Golden-Tests
pnpm test:e2e       # Playwright
pnpm lint
pnpm build
pnpm dist           # Windows-Installer und portable .exe
pnpm docs:reference # Referenz aller Blöcke und Komponenten nach docs/reference erzeugen
```

Lege diese Skripte in Phase 0 an (`assets:fetch` in Phase 2, `dist` spätestens in Phase 9) und halte sie aktuell.

## Feste Konventionen

- Koordinaten: Y zeigt nach oben, 1 Einheit = 1 Meter. Blöcke zeigen Winkel in Grad, intern Radiant. Zeit in Blöcken in Sekunden.
- Modelle in der Bibliothek: Massstab normalisiert, Drehpunkt unten mittig, GLB.
- Jedes Asset hat eine `.meta.json` mit stabiler ID. Verweise nur über IDs.
- Der Compiler unterstützt von Anfang an Funktionen mit Rückgabewert und lokale Variablen in der Zwischenrepräsentation, auch wenn die Oberfläche dafür erst später kommt.
- Englische Oberfläche nutzt die aus Unity bekannten Begriffe, deutsche Oberfläche die Übersetzungen aus `SPEC.md` 5.1.

## Code-Regeln

- Kein `any`. Öffentliche Funktionen bekommen Typen und einen kurzen Kommentar.
- Bezeichner, Kommentare und Commit-Messages auf Englisch. **Alle Texte in der Oberfläche auf Deutsch und Englisch**, ausschliesslich über die i18n-Dateien, nie hart im Code.
- Blöcke werden **nur** in `packages/blocks` definiert. Blockly-Definitionen, Compiler-Zuordnung, Palette pro Bereich, Doku und KI-Blockkatalog werden daraus erzeugt.
- Komponenten werden einmal definiert (Felder, Typen, Standardwerte, Texte, Blöcke); Inspektor, Figuren-Studio, Doku und KI-Katalog lesen dieselbe Definition.
- `packages/runtime` importiert nichts aus `apps/` oder Blockly. Exportierte Spiele enthalten nur die Laufzeit.
- Projektdateien deterministisch schreiben: sortierte Schlüssel, 2 Leerzeichen Einrückung, LF-Zeilenenden, stabile IDs. Ein unverändertes Projekt erzeugt beim Speichern null Git-Diffs.
- Jede neue Blockart bekommt mindestens einen Golden-Test (Block-JSON → erwartetes JS) und einen Laufzeittest.
- Leistung im Blick behalten: Draw Calls und Bildzeit in jedem Beispielprojekt messen, gleiche Modelle automatisch instanziieren.
- Netzwerk nur an zwei Stellen: `pnpm assets:fetch` beim Entwickeln und der KI-Assistent, wenn der Nutzer einen eigenen API-Schlüssel hinterlegt. Keine Telemetrie.

## Was du nicht tust

- Nicht `scratch-gui`, `scratch-blocks` oder `scratch-vm` forken. Wir bauen auf Blockly und eigener Laufzeit.
- Keine Namen, Logos, Icons, Maskottchen oder Grafiken von Scratch, Unity oder anderen Produkten verwenden. Aufbau, Begriffe und Bedienung von Unity übernehmen ist erwünscht, das Aussehen ist eigenständig.
- Keine Modelle in die mitgelieferte Bibliothek aufnehmen, die nicht CC0 sind. Keine Mixamo-Dateien und keine Dateien aus Bezahl-Stores mitliefern (eigener Import durch den Nutzer ist erlaubt).
- Keine Geheimnisse (API-Schlüssel, Tokens) committen. Kein Force-Push auf `main`.
- Keine Bezahlschranken, Build-Limits oder Konto-Pflicht einbauen.
- Keine Abnahmekriterien überspringen oder abschwächen, um eine Phase schneller abzuschliessen.

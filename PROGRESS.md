# Fortschritt

Stand der Phasen aus `SPEC.md`, Abschnitt 10. Pro Phase: Plan vor Beginn, Ergebnis der Abnahme danach.

| Phase | Titel | Status |
|---|---|---|
| 0 | Fundament und Unity-Layout | abgeschlossen |
| 1 | Objekte, Komponenten, Block-Skripte, Play-Modus | abgeschlossen |
| 2 | Projekt-Fenster, Asset-Bibliothek, Prefabs | in Arbeit |
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

## Phase 2: Projekt-Fenster, Asset-Bibliothek, Prefabs

Branch: `phase/02-bibliothek` (baut auf Phase 1 auf).

### Plan

**Teilaufgaben**

1. **Asset-Bibliothek bauen** (`packages/library`, SPEC 6.1, 6.2, Anhang C)
   - Quellenbeschreibungen in `packages/library/sources/*.json` (URL, Lizenz, Urheber, Kategorien und Tags nach Dateinamen, Übersetzungen der Namen, Collider-Vorschlag, Animationsnamen).
   - `pnpm assets:fetch`: lädt die Pakete (Git oder ZIP), prüft die Lizenz (nur CC0), optimiert jedes Modell mit `@gltf-transform` (Duplikate, Schweissen, Meshopt-Kompression), normalisiert Massstab und Drehpunkt (unten mittig), rendert Vorschaubilder (Playwright + three.js) und schreibt `library/index.json` und `library/LICENSES.md`. Bereits verarbeitete Modelle werden übersprungen (Cache).
   - Startpaket: KayKit-Pakete (CC0, offiziell auf GitHub): Mittelalter-Hexagon, Dungeon, Stadt, Möbel, Restaurant, Halloween, Raumbasis, Prototyp, Abenteurer- und Skelett-Figuren (zusammen rund 900 Modelle). Kenney, Quaternius und Poly Haven bekommen ebenfalls Quellenbeschreibungen.
2. **Laufzeit:** Modelle laden (GLTF mit Meshopt), Modell-Feld im Modell-Renderer (Bibliotheks- oder Projekt-Modell statt Grundform), **automatische Instanziierung** gleicher Modelle (`InstancedMesh`), Collider-Vorschlag aus den Modellmassen.
3. **Projektformat** (Erweiterung, siehe Vorschlag unten): Binärdateien, Asset-Typen „Modell“ und „Prefab“, Prefab-Exemplare mit Überschreibungen, Varianten, verschachtelte Prefabs.
4. **Editor**
   - Asset-Bibliothek: Raster mit Vorschaubildern, Kategorien, unscharfe Suche (de/en), Filter (animiert, Polygonanzahl), Favoriten, zuletzt benutzt, drehbare 3D-Vorschau, „In Projekt importieren“.
   - Hineinziehen in die Szene mit Aufsetzen auf die Oberfläche unter dem Mauszeiger; **Pinsel** zum Verteilen vieler Objekte mit zufälliger Drehung und Grösse.
   - Projekt-Fenster: Modelle importieren (Datei hineinziehen oder Menü; GLB/glTF direkt, FBX/OBJ werden zu GLB), Import-Inspektor (Massstab mit 1,8-m-Vergleichsfigur, Drehpunkt, Collider erzeugen, Lizenz), Vorschaubilder, Grössenregler, Typfilter.
   - Prefabs wie Unity: Objekt aus der Hierarchie ins Projekt-Fenster ziehen erzeugt ein Prefab; Exemplare blau in der Hierarchie; Prefab-Modus per Doppelklick; überschriebene Werte fett mit Randmarkierung, „Übernehmen“/„Zurücksetzen“ pro Wert und für alles; Varianten; verschachtelte Prefabs; „Meine Prefabs“ (projektübergreifend, mit Abhängigkeiten).
5. **Beispiel** `examples/02-dorf` (Häuser, Brunnen, Zäune, 200 Bäume) und Abnahme mit Tests, Messung der Bildrate und Screenshot.

**Vorschlag Formaterweiterung** (zur Bestätigung; Umsetzung erst nach der Bibliothek)

```
Assets/Modelle/haus.glb               importiertes Modell (binär) + haus.glb.meta.json
                                      meta.importSettings: { scale, pivot, generateCollider }, meta.license
Assets/Prefabs/laterne.prefab.json    { formatVersion, root, objects: { ID → Objekt wie in Szenen },
                                        base?: Prefab-ID der Basis (Variante), overrides: [...] }
Szene, Prefab-Exemplar:               Objekt erhält  prefab: { asset: Prefab-ID, object: ID im Prefab }
                                      und am Exemplar-Wurzelobjekt  overrides: [ { object, path, value } ]
Modell-Renderer:                      Feld  model: "library:<ID>" oder Projekt-Asset-ID (statt Grundform)
```

- Exemplare werden in der Szene vollständig gespeichert (lesbar, die Laufzeit braucht keine Prefab-Logik). Beim Laden und nach jeder Prefab-Änderung werden sie aus dem Prefab neu erzeugt, die Überschreibungen bleiben. Position, Drehung und Name des Exemplar-Wurzelobjekts gelten immer als überschrieben (wie in Unity).
- Varianten speichern nur ihre Unterschiede zur Basis (gleiche Überschreibungs-Liste). Verschachtelte Prefabs sind Prefab-Exemplare innerhalb eines Prefabs.
- Bibliotheksmodelle werden nur per stabiler ID verwiesen und nicht ins Projekt kopiert; „In Projekt importieren“ kopiert das GLB nach `Assets/Modelle/`.

**Betroffene Pakete:** `library` (neu befüllt), `runtime`, `project`, `apps/editor`, `apps/desktop` (Bibliothek ausliefern, Binärdateien), `examples/`, `.github/workflows` (Bibliothek in der CI laden und zwischenspeichern).

**Risiken**

- Netzwerk: In dieser Cloud-Umgebung sind kenney.nl, quaternius.com, itch.io und polyhaven.com gesperrt, GitHub ist erreichbar. Das Startpaket kommt deshalb hier aus den KayKit-Paketen auf GitHub; die übrigen Quellen funktionieren auf Rechnern mit normalem Internetzugang und in der CI.
- Texturkompression: `sharp` (Standardweg von `@gltf-transform`) bringt libvips unter LGPL mit und ist nicht erlaubt. KayKit nutzt eine kleine Farbpalette als Textur, daher bleiben Texturen PNG; Meshopt verkleinert die Geometrie.
- Bildrate: Die CI rendert ohne Grafikkarte (SwiftShader). 60 FPS werden über Draw Calls (Instanziierung) und die Bildzeit gemessen; Messwerte aus der Software-Darstellung sind nur ein Anhaltspunkt.
- Grösse: Die Bibliothek (rund 100 MB) liegt nicht im Repository (`library/` ist in `.gitignore`), die CI lädt und speichert sie zwischen.

## Phase 1: Objekte, Komponenten, Block-Skripte, Play-Modus

Branch: `phase/01-objekte` (baut auf Phase 0 auf, PR #1 ist noch nicht gemergt).

### Plan

**Teilaufgaben**

1. **Projektformat** (`packages/project`, SPEC 9.1)
   - Dateisystem-Schnittstelle mit drei Umsetzungen: im Speicher (Tests), Node.js (Electron, Tests, Beispiele), Browser (Origin Private File System, Projekte bleiben im Browser gespeichert).
   - zod-Schemas, Formatversion, Migrationen mit Sicherungskopie, deterministisches Schreiben (sortierte Schlüssel, 2 Leerzeichen, LF). Gespeichert werden nur Dateien, deren Inhalt sich geändert hat.
   - Meta-Dateien mit stabiler ID pro Asset, Verweise nur über IDs. Umbenennen und Verschieben von Assets nimmt die Meta-Datei mit.
2. **Laufzeit** (`packages/runtime`)
   - `defineComponent` als einzige Quelle für Komponenten (Felder, Typen, Standardwerte, Texte). Komponenten in Phase 1: Transform, Modell-Renderer (Grundformen), Material, Box-/Kugel-/Kapsel-Collider (Überlappungstest ohne Physik, Rapier folgt in Phase 3), Kamera, Licht, Block-Skript.
   - Welt aus Szenendaten aufbauen; Scheduler mit fester 60-Hz-Logikrate, Reihenfolge nach SPEC 8.1, Generator-Threads nach Anhang B, Interpolation fürs Rendern.
   - Dienste für Skripte: Eingabe (Tasten, Maus), Zeit, Warten, Stoppuhr, Zufall, Berührungen, Erzeugen/Zerstören, Variablen (Objekt und Spiel), Variablen-Anzeigen auf dem Bildschirm.
   - Fehler in Skripten stoppen nur den Thread und landen mit Block-ID in der Konsole.
3. **Blöcke und Compiler**: alle Blöcke aus Anhang A mit „(1)“ (Ereignisse, Bewegung, Aussehen, Steuerung, Fühlen, Operatoren, Variablen). Scratch-artige Typumwandlung, Objekt-, Tag- und Tasten-Auswahllisten aus der Szene. Jede Blockart mit Golden- und Laufzeittest.
4. **Editor**
   - Projekt öffnen, speichern (`Strg+S`), automatisch speichern; Beispielprojekt öffnen; neues Projekt aus Vorlage.
   - Hierarchie: Eltern-Kind, Ziehen und Ablegen, Umbenennen (`F2`), Duplizieren (`Strg+D`), Löschen (`Entf`), leeres Objekt (`Strg+Shift+N`). Bereichs-Reiter sind Wurzel-Objekte und filtern die Hierarchie.
   - Szene: Gizmos für Verschieben, Drehen, Skalieren, Kombi mit Einrasten (`Strg`), Mehrfachauswahl (`Strg`/`Shift`), Grundformen im Menü „Objekt“.
   - Inspektor: Kopfzeile (Aktiv, Name, Tag, Ebene, Statisch), Transform, Komponenten aus `defineComponent`, „Komponente hinzufügen“ mit Suche, Kontextmenü (Zurücksetzen, Kopieren, Einfügen, Entfernen, nach oben/unten), Mehrfachbearbeitung mit „—“.
   - Block-Skript als Asset im Projekt-Fenster und als Komponente; Variablen-Liste im Block-Editor mit „im Inspektor zeigen“; Doppelklick öffnet den Block-Editor.
   - Rückgängig/Wiederholen für alle Änderungen an der Szene.
   - Play-Modus: Start in unter 1 Sekunde, Zurücksetzen beim Stoppen, „Diesen Wert behalten“, Pause, Einzelbild, Zeitlupe (0,25×, 0,5×), Hot Reload der Blöcke, Tönung des Editors.
   - Konsole: Klick auf einen Eintrag springt zum Block bzw. Objekt.
5. **Beispiel** `examples/01-hindernis` und Abnahme mit Tests und Screenshot.

**Vorschlag Projektformat** (Details zu SPEC 9.1, vor der Umsetzung zur Bestätigung)

```
mein-spiel/
  blockwerk.json                         { formatVersion, name, startScene (Asset-ID), settings }
  Assets/
    Szenen/hindernis.scene.json          Objekte als Map ID → Objekt (Name, Eltern-ID, Reihenfolge,
                                         Aktiv, Tag, Ebene, Statisch, Transform, Komponenten-Liste)
    Szenen/hindernis.scene.json.meta.json { formatVersion, id, type, importSettings, license }
    Block-Skripte/steuerung.blocks.json  { formatVersion, variables[], workspace (Blockly-JSON) }
    Block-Skripte/steuerung.blocks.json.meta.json
  Einstellungen/tags-und-ebenen.json      Tags und Ebenen
  .blockwerk/                            Sicherungskopien, Cache (in .gitignore)
```

- Objekte stehen als Map mit sortierten IDs in der Datei, die Reihenfolge unter Geschwistern als Zahl `order`. So erzeugt eine Änderung nur Diffs am betroffenen Objekt.
- Bereichs-Reiter sind Wurzel-Objekte mit einem Feld `area` (Art des Bereichs).
- Meta-Dateien heissen wie die Datei plus `.meta.json` (wie Unitys `.meta`).
- IDs: 12 Zeichen Kleinbuchstaben und Ziffern, zufällig.

**Betroffene Pakete:** `project` (neu befüllt), `runtime`, `blocks`, `compiler`, `apps/editor`, `apps/desktop` (Dateizugriff über IPC), `examples/`.

**Risiken**

- Umfang: Phase 1 ist die grösste Phase bisher. Reihenfolge: Laufzeit und Compiler zuerst (testbar ohne Oberfläche), dann Projektformat, dann Editor.
- Isolation des Play-Modus: Skriptfehler werden pro Thread abgefangen. Endlosschleifen ohne Frame-Abgabe können in Phase 1 nicht entstehen (Schleifen geben immer den Frame ab); die Absicherung dafür kommt mit eigenen Blöcken „ohne Bildschirmaktualisierung“ (Phase 7/8).
- Berührungen ohne Physik-Engine: einfache Überlappungstests der Collider. Rapier ersetzt das in Phase 3, die Blöcke bleiben gleich.
- Browser-Speicher (OPFS) ist pro Browser-Profil; Export/Import als Ordner folgt mit der Desktop-App bzw. Phase 9.

### Annahmen

- **Projektformat wie vorgeschlagen** (keine Einwände). Die Ordner unter `Assets/` heissen bei neuen Projekten wie die Oberfläche (deutsch „Szenen“, „Block-Skripte“; englisch „Scenes“, „Block Scripts“); `Einstellungen/` und `.blockwerk/` sind feste Namen wie in SPEC 9.1. Neue Projekte bekommen eine `.gitignore` mit `.blockwerk/`.
- **Speicherort:** Im Browser liegen Projekte im privaten Dateisystem des Browsers (OPFS), in der Desktop-App als echte Ordner unter `Dokumente/Blockwerk` (oder in einem frei gewählten Ordner über „Projekt öffnen → Anderen Ordner wählen“). Die Desktop-App erlaubt Dateizugriffe nur in Projektordnern, die angelegt oder gewählt wurden.
- **Automatisches Speichern** zwei Sekunden nach jeder Änderung und beim Verlassen der Seite, nie während des Spielens. Abschaltbar unter „Datei → Automatisch speichern“.
- **Berührungen ohne Physik:** Collider werden auf Überlappung geprüft (Würfel, Kugel, Kapsel). Objekte laufen noch durch Hindernisse hindurch; Rapier kommt in Phase 3, die Blöcke bleiben gleich.
- **Blöcke mit Phase-2-Bezug:** „erzeuge [Prefab | Asset] bei [ ] → gibt Objekt zurück“ gibt es in Phase 1 als „erzeuge Kopie von [Objekt]“ (Unity: Instantiate eines Szenenobjekts); die Prefab-Variante mit Rückgabewert folgt mit Prefabs in Phase 2. „setze Farbe / Material“ setzt in Phase 1 die Farbe (Material-Assets folgen). „aktiviere / deaktiviere“ wirkt auf Objekte; Komponenten folgen.
- **„zerstöre [mich | Objekt]“** ist ein Stapelblock; zerstört er das eigene Objekt, endet das Skript sofort (wie „lösche diesen Klon“ in Scratch).
- **Blickrichtung:** 0° schaut nach +Z, 90° nach +X, genau wie die Y-Drehung im Inspektor. Wegen des bestätigten Koordinatensystems (+X ist links) wird der Wert beim Rechtsdrehen kleiner.
- **Maus x/y** in Pixeln ab der Mitte der Spielansicht, oben und rechts positiv (wie Scratch).
- **Block-ID umbenannt:** Der Testblock `motion.moveForward` aus Phase 0 heisst jetzt `motion.move` mit Richtungsauswahl. Es gab noch kein Release, daher ohne Migration.
- **Variablen** in Phase 1: Typen Zahl, Text, Wahrheitswert; Gültigkeit „für dieses Objekt“ (im Inspektor zeigbar, Wert pro Objekt in der Block-Skript-Komponente) oder „für das ganze Spiel“. Szenen- und lokale Variablen kommen mit Phase 5/7 (lokale Variablen sind im Compiler schon vorhanden), „wird gespeichert“ mit Phase 6.
- **Play-Modus:** Szenen- und Spielansicht zeigen beide die laufende Spielwelt; Hierarchie und Inspektor zeigen live die Spielobjekte (auch Kopien). Änderungen im Inspektor oder mit Gizmos wirken nur aufs Spiel; „Diesen Wert behalten“ steht neben jedem geänderten Wert, „Alle Änderungen dieses Objekts behalten“ als Knopf über dem Inspektor (statt nur per Rechtsklick).
- **Startzeit des Play-Modus** wird vom Klick bis zum ersten fertig gezeichneten Spielbild gemessen und in der Konsole ausgegeben. Dafür übernimmt die Spielwelt das vorberechnete Himmelslicht der Editor-Welt; die Himmelslicht-Karte ist 64 px gross (genügt für diffuses Licht, spart viel Zeit).
- **Leuchten laufender Skripte:** Skripte, die in der letzten Viertelsekunde liefen, leuchten (sonst wären kurze Skripte wie „Wenn Taste gehalten“ nie sichtbar).
- **Einrasten mit `Strg`** in Unity-Standardschritten: 0,25 m, 15°, Skalierung 0,1.
- **Neue Objekte** erscheinen am Drehpunkt der Szenen-Kamera im aktiven Bereich (Unity: am Szenen-Drehpunkt). Grundformen bekommen wie in Unity passend einen Collider.
- **Kombi-Werkzeug** zeigt Verschiebe- und Drehgriffe zusammen; das Rechteck-Werkzeug verhält sich bis zur UI-Phase wie Verschieben.
- **Eingebaute Tags** wie in Unity: `Untagged`, `MainCamera`, `Player`; Ebene `Default`. Eigene Tags und Ebenen über die Auswahlliste im Inspektor.
- **Unbekannte Komponenten** (z. B. aus einer neueren Version) bleiben beim Speichern unverändert erhalten.
- **Beispielprojekte** werden im Editor über „Datei → Beispielprojekt öffnen“ als Kopie geöffnet; die Dateien in `examples/` bleiben unberührt. Prettier formatiert Projektdateien in `examples/` nicht (der Editor schreibt sie selbst deterministisch).

### Ergebnis

**Umgesetzt**

- **Laufzeit:** Komponenten über `defineComponent` (Modell-Renderer mit Grundformen und Material, Box-/Kugel-/Kapsel-Collider, Kamera, Licht, Block-Skript); Welt aus Szenendaten mit inkrementellem Abgleich; Spiel mit fester 60-Hz-Logik, Generator-Threads, Interpolation, Ereignissen (Start, jeder Frame, Tasten, Klick, Berühren, Erstellen, Zerstören), Kopien, Variablen und Anzeigen. Skriptfehler stoppen nur den betroffenen Thread und melden die Block-ID.
- **Blöcke:** alle Blöcke aus Anhang A mit „(1)“ (Ereignisse, Bewegung, Aussehen, Steuerung, Fühlen, Operatoren, Variablen), Auswahllisten mit Objekten und Tags der Szene (stabile IDs), Farbfeld, Variablenfelder. Scratch-artige Typumwandlung an Steckplätzen. Jeder Block mit Golden- und Laufzeittest.
- **Projektformat:** `packages/project` mit Dateisystem-Schnittstelle (Speicher, Node, Browser, Desktop über IPC), Meta-Dateien mit stabilen IDs, deterministischem Schreiben nur geänderter Dateien, sicherem Umbenennen (auch nur Gross-/Kleinschreibung), Meldungen zu beschädigten, kopierten oder neueren Dateien, Migrationen mit Sicherungskopie.
- **Editor:** Projekt neu/öffnen/Beispiel, Speichern (`Strg+S`), automatisches Speichern, Rückgängig/Wiederholen (`Strg+Z`/`Strg+Y`). Hierarchie mit Bereichen als Wurzel-Objekten, Ziehen und Ablegen (behält die Weltposition), Umbenennen (`F2`), Duplizieren (`Strg+D`), Löschen (`Entf`), Kontextmenü, Suche, Mehrfachauswahl (`Strg`/`Shift`). Szene mit Gizmos (Verschieben, Drehen, Skalieren, Kombi; Pivot/Mitte, Lokal/Global; Einrasten mit `Strg`), Kamera- und Licht-Symbolen, Auswahlrahmen. Inspektor aus den Komponenten-Definitionen mit Mehrfachbearbeitung („—“), Ziehen an Feldbeschriftungen, Kontextmenü (Zurücksetzen, Werte kopieren/einfügen, Entfernen, nach oben/unten), „Komponente hinzufügen“ mit Suche und Kategorien, Tags und Ebenen. Projekt-Fenster mit Ordnerbaum, Erstellen, Umbenennen, Löschen, Verschieben per Ziehen, Doppelklick öffnet. Block-Editor mit Skriptauswahl, Kopfzeile (Skript und Objekt), Variablenliste rechts (Typ, Gültigkeit, Startwert, „im Inspektor zeigen“).
- **Play-Modus:** Play/Pause/Einzelbild (`Strg+P`, `Strg+Shift+P`, `Strg+Alt+P`), Zeitlupe 0,5× und 0,25×, Tönung des Editors, Spielansicht bekommt die Tastatur, Variablen-Anzeigen, Hot Reload der Blöcke, leuchtende Skripte, „Diesen Wert behalten“, Zurücksetzen beim Stoppen. Konsole mit Sprung zu Block und Objekt.
- **Desktop:** Projekte als echte Ordner, Zugriff nur auf freigegebene Projektordner.
- **Beispiel** `examples/01-hindernis`: Parcours aus Grundformen, gesteuerter Würfel (Block-Skript „Steuerung“ mit Inspektor-Feld „Tempo“), zweiter Würfel mit demselben Skript und anderem Tempo, drei Kugeln mit Tag `Einsammelbar` (Skript „Einsammeln“), Punkteanzeige.

**Abnahme**

- [x] `examples/01-hindernis`: Ein Würfel mit Block-Skript wird mit WASD gesteuert, sammelt drei Kugeln (Tag `Einsammelbar`), Punkte erscheinen; die Geschwindigkeit ist ein Inspektor-Feld (Unit-Test ohne Oberfläche und E2E-Test im Editor mit echten Tastendrücken).
- [x] Dasselbe Block-Skript an einem zweiten Würfel mit anderer Geschwindigkeit funktioniert unabhängig (Tempo 2 statt 4: halbe Strecke, geprüft in beiden Tests).
- [x] Play-Modus startet in unter 1 Sekunde (gemessen vom Klick bis zum ersten Spielbild, im Software-Renderer der Tests etwa 30–160 ms), Stoppen setzt zurück, ein behaltener Wert bleibt (E2E).
- [x] Speichern, schliessen, laden: identisch; erneutes Speichern ändert keine Datei (null Git-Diffs; geprüft am Beispiel auf der Festplatte, im Browser per Neuladen und in der Desktop-App per Neustart). Ein Asset umbenennen bricht keinen Verweis (Unit- und E2E-Test).
- [x] `pnpm test`, `pnpm lint`, `pnpm build` grün; CI auf GitHub siehe Pull Request.

Messung im Beispielprojekt (Spielansicht, Software-Renderer): 27 Draw Calls, 14 160 Dreiecke, Bildzeit 3,5 ms.

Tests: 135 Unit-/Golden-/Laufzeittests (Vitest), 33 End-to-End-Tests (31 Browser, 2 Desktop-App). Screenshot: `docs/screenshots/phase-01.png`.

**Offen / Hinweise für später**

- Physik (Rapier) kommt in Phase 3; bis dahin gibt es keine Schwerkraft und keine festen Hindernisse.
- Gleiche Modelle teilen sich die Geometrie, werden aber noch nicht automatisch instanziiert (kommt mit den Bibliotheksmodellen in Phase 2).
- Objekte aus der Hierarchie auf Block-Steckplätze bzw. Verweise per Ziehen in Inspektor-Felder ziehen (SPEC 5.7, 5.9), Tippen zum Block-Suchen (7.8), „Von hier spielen“ (5.5), Einrasten an Eckpunkten (`V`) und das Ebenen-Menü sind noch nicht umgesetzt.
- Browser-Projekte bleiben im jeweiligen Browserprofil; Import/Export als Ordner bzw. `.blockwerk`-Datei folgt.

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

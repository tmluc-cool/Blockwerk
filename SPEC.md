# Blockwerk – Spezifikation (3D, Unity-ähnlich)

Arbeitstitel, Name kann später geändert werden.

## Kurzfassung

Blockwerk ist eine kostenlose, quelloffene **3D-Game-Engine**, die sich **wie Unity bedienen lässt**, bei der aber die Logik mit **Scratch-artigen Befehlsblöcken** statt mit C# gebaut wird.

- **Alles ausser der Logik ist an Unity angelehnt:** Fensteraufbau (Hierarchie, Szene, Spiel, Inspektor, Projekt, Konsole), Objekte mit Komponenten, Prefabs, Play-Modus, Szenen-Navigation, Tastenkürzel, Begriffe und Arbeitsabläufe. Wer Unity kennt oder Unity-Tutorials schaut, findet sich sofort zurecht.
- **Die Logik ist wie Scratch:** Ein „Block-Skript“ ist eine Komponente, die man an ein Objekt hängt, genau wie ein Skript in Unity. Statt Code steckt man farbige Blöcke zusammen („Wenn Taste W gehalten → gehe vorwärts“).
- **Bereichs-Reiter:** Umgebung, Spieler 1, Spieler 2, NPCs, Gegenstände, UI und eigene Reiter ordnen das Projekt.
- **Asset-Bibliothek:** eingebaute Datenbank mit fertigen 3D-Objekten (Bäume, Häuser, animierte Figuren, Fahrzeuge …) zum Hineinziehen.
- **Testmodus:** Play-Knopf wie in Unity, dazu ein eingebautes Testgelände.
- **Figuren-Studio:** Im Spieler- und NPC-Bereich eine grafische Ansicht, in der man alles an der Figur verändert: Modell aus der Bibliothek wählen oder eigenes 3D-Modell hochladen, Figur aus Teilen zusammenbauen, Farben, Ausrüstung, Animationen, Bewegungsgefühl und Fähigkeiten.
- **Open Source auf GitHub:** öffentliches Repository unter MIT-Lizenz, automatische Tests, Releases mit Installer, Doku und Web-Demo auf GitHub Pages.

**Endziel:** Mit Blockwerk entsteht ein spielbares 3D-Spiel, das sich anfühlt, als wäre es in Unity gemacht.

Grundlage ist eine Analyse von Unity, Unity Visual Scripting, Scratch, TurboWarp, PenguinMod, MakeCode Arcade, ct.js (Catnip), GDevelop, Construct 3, Stencyl, CoSpaces Edu und Unreal Blueprints sowie der häufigsten Beschwerden aus Nutzerbewertungen, Foren und Forschung (Quellen in Anhang E).

### Annahmen (vom Nutzer jederzeit änderbar)

- **Spieler 2** spielt lokal am selben Rechner (geteilter Bildschirm oder gemeinsame Kamera, Gamepad oder zweite Tastenbelegung). Online-Mehrspieler kommt später.
- Standard-Spielerfigur ist **Third-Person**. First-Person und Draufsicht sind wählbar.
- Version 1 ist **nur 3D**. Ein 2D-Modus kommt später.
- Zielplattform zum Spielen: **Windows-PC** (und Browser). Handys kommen später.
- Lizenz des Codes: **MIT**. Vor der ersten Veröffentlichung prüfen, ob der Name „Blockwerk“ auf GitHub und als Marke schon belegt ist.

---

## 1. Vision und Zielbild

**Leitsatz:** Bedienen wie Unity, programmieren wie Scratch, spielen wie ein echtes Spiel.

**Zielgruppe:** Einsteiger und Vibecoder, die ein echtes 3D-Spiel bauen wollen, ohne C# oder JavaScript zu lernen, und dabei eine Arbeitsweise lernen, die sie später direkt in Unity weiterverwenden können.

### 1.1 Unity-Gefühl-Checkliste (für das fertige Spiel)

Diese Liste ist ab Phase 3 Teil jeder Abnahme:

1. Die Figur beschleunigt und bremst weich, dreht sich flüssig in Laufrichtung, nichts ruckt.
2. Die Kamera folgt mit leichter Verzögerung, lässt sich mit Maus oder rechtem Stick drehen und weicht Wänden aus.
3. Animationen gehen weich ineinander über (Stehen → Gehen → Rennen → Springen → Fallen), die Füsse rutschen nicht sichtbar.
4. Echte Schatten, weiches Licht, Himmel, Nebel in der Ferne, leichtes Bloom und Umgebungsverdeckung.
5. Physik wirkt glaubwürdig: Kisten fallen um, die Figur schiebt lose Objekte, Treppen und Rampen funktionieren.
6. Ton: Schritte, Sprünge, Treffer. Klänge werden mit Entfernung leiser und kommen aus der richtigen Richtung.
7. Rückmeldung: Staub beim Landen, Partikel bei Treffern, kurzes Kamerawackeln.
8. Hauptmenü, Pausemenü, Einstellungen (Grafikstufe, Lautstärke, Maus-Empfindlichkeit, Tastenbelegung).
9. Ladebildschirm statt Ruckeln beim Szenenwechsel.
10. Stabile 60 Bilder pro Sekunde auf der Grafikstufe „Hoch“ (Abschnitt 12).

### 1.2 Editor-Gefühl: Unity als Vorbild

- Gleiche Fensteraufteilung, gleiche Begriffe, gleiche Tastenkürzel, gleiche Arbeitsabläufe wie in Unity (Details in Abschnitt 5).
- Faustregel für alle Entscheidungen ausserhalb der Logik: **„Wie macht Unity das?“** Dann so umsetzen, ausser es steht auf der Beschwerdeliste in Abschnitt 3; dann die dort beschriebene Verbesserung.
- Eigenes Design: keine Unity-Logos, -Icons oder -Grafiken, kein Unity-Name im Produkt. Übernommen werden Aufbau, Begriffe und Bedienung, nicht das Aussehen im Detail.

---

## 2. Was wir von den bestehenden Tools übernehmen

| Tool | Stärken, die Blockwerk übernimmt |
|---|---|
| **Unity** | Fensteraufbau, Objekte mit Komponenten, Inspektor, Prefabs und Prefab-Varianten, Play-Modus, Szenen-Navigation, Asset-Store-artige Bibliothek, Build-Einstellungen, klare Struktur aus Objekten, Komponenten und Skripten, die viele Nutzer als einsteigerfreundlich loben |
| **Scratch** | Farbige Blockkategorien, Blockformen zeigen, was wo passt, laufende Skripte leuchten, sehr niedriger Einstieg |
| **CoSpaces Edu** | 3D-Welten für Einsteiger mit Blöcken programmierbar |
| **TurboWarp** | Blöcke werden zu JavaScript kompiliert statt interpretiert, dadurch viel schneller |
| **PenguinMod** | Grosse Blockbibliothek, komplexe Projekte nur mit Blöcken |
| **MakeCode Arcade** | Spielspezifische Blöcke, Umschalten zwischen Blöcken und Code |
| **ct.js / Catnip** | Jeder Block entspricht einem festen Stück JavaScript, Blöcke sind tippbar *und* ziehbar, Eingabe-„Aktionen“ |
| **GDevelop** | Über hundert fertige Verhalten, Live-Vorschau mit Hot Reload, Diagnosebericht vor dem Start, KI-Agent, der sichtbar im Projekt baut |
| **Construct 3** | Objektfamilien (Gruppen), optionales JavaScript für Fortgeschrittene |
| **Stencyl** | Scratch-inspirierte Blöcke für echte Spiele |
| **Unreal Blueprints** | Beweis, dass grosse Spiele komplett visuell programmierbar sind |

---

## 3. Beschwerden aus Bewertungen und wie Blockwerk sie löst

Jede Zeile ist eine Anforderung. Wo Blockwerk Unity nachbaut, gelten diese Verbesserungen gegenüber Unity.

| # | Problem (Tool) | Lösung in Blockwerk | Phase |
|---|---|---|---|
| 1 | Harte Grenzen bei der Anzahl Objekte: 300 Klone (Scratch), höchstens 10 Block-Skripte pro Szene (CoSpaces Edu) | Keine künstlichen Grenzen. Pooling, Instanziierung, Profiler warnt statt zu blockieren | 1, 5 |
| 2 | Langsame Ausführung: 30 FPS (Scratch), Visual Scripting per Reflection deutlich langsamer als Code (Unity Visual Scripting) | Blöcke werden zu JavaScript kompiliert, Logik mit festen 60 Hz, GPU-Rendering | 1 |
| 3 | Editor schwerfällig, lange Ladezeiten, viel Arbeitsspeicher, lange Skript-Kompilierung (Unity) | Keine Kompilierwartezeit: Blöcke werden in Millisekunden übersetzt, Play-Modus startet sofort, Assets werden vorab optimiert | 1, 2 |
| 4 | Abstürze und kryptische Fehler, die erst nach Neustart verschwinden (Unity) | Play-Modus läuft isoliert, Fehler im Spiel bringen den Editor nie zum Absturz, Meldungen in Alltagssprache | 1, 8 |
| 5 | Kaum Debugging: keine Werkzeuge (Scratch), Klick auf Fehler führt nirgendwohin, kaputte Graphen nicht auffindbar (Unity Visual Scripting) | Konsole mit Sprung zum Block, Haltepunkte, Schrittmodus, Inspektor im Play-Modus, Diagnose vor dem Start | 8 |
| 6 | Eigene Blöcke ohne Rückgabewert, keine lokalen Variablen (Scratch) | Eigene Blöcke als Befehl, Wert oder Bedingung, lokale Variablen, veränderbare Parameter | 7 |
| 7 | Skripte mit eigenen Blöcken in ein anderes Projekt kopieren erzeugt „undefinierte“ Blöcke (Scratch) | Kopieren und Exportieren nimmt alle Abhängigkeiten automatisch mit | 7 |
| 8 | Versionsverwaltung schwierig: Szenen und Graphen binär oder schwer zusammenführbar (Unity, Unity Visual Scripting, Unreal Blueprints) | Szenen, Prefabs und Block-Skripte sind lesbare JSON-Dateien mit stabilen IDs | 1 |
| 9 | Umbenennen und Refactoring brechen Verweise (Unity Visual Scripting, Unreal Blueprints) | Verweise über stabile IDs, „Überall umbenennen“ für Variablen, Nachrichten, Blöcke, Objekte, Assets | 1, 7 |
| 10 | Projekt-Upgrades auf neue Versionen machen Assets kaputt (Unity) | Formatversion im Projekt, automatische Migrationen mit Tests, Sicherungskopie vor jeder Migration | 1 |
| 11 | Animationssystem schwer verständlich (Unity) | Automatische Animations-Zuordnung (Stehen, Gehen, Rennen, Springen …) mit Überblendung ohne Zustandsdiagramm; einfache Blöcke wie „spiele Animation [Winken]“ | 3 |
| 12 | Blöcke ziehen ist langsamer als Tippen (Forschung zu Blocksprachen) | Blöcke per Tippen suchen und einfügen, Ausdrücke wie `x/2 + 10` direkt tippen | 7 |
| 13 | Blöcke brauchen viel Platz, man findet in grossen Projekten nichts (Forschung) | Bereichs-Reiter, projektweite Suche, „Gehe zu Definition“, „Alle Verwendungen“, Einklappen, Aufräumen | 0, 7 |
| 14 | Nutzer zerlegen grosse Block-Programme selten in Funktionen (Forschung) | Rechtsklick „Als eigenen Block auslagern“, Hinweis bei sehr langen Skripten | 7 |
| 15 | Wechsel zwischen Blöcken und Code kann Projekte beschädigen (MakeCode Arcade) | Blöcke sind die einzige Quelle, Code-Ansicht nur lesend, eigener Code nur im „Code-Block“ | 7 |
| 16 | Projekte werden mit wachsender Grösse unübersichtlich, Assets unordentlich (GDevelop) | Bereichs-Reiter, Projekt-Fenster mit Ordnern, Suche, Tags und „nicht verwendet“-Erkennung | 0, 2 |
| 17 | Schwache 3D-Unterstützung (GDevelop, Construct 3) | 3D von Grund auf: PBR-Grafik, Schatten, Physik, Charakter-Controller, Navigation | 1–4 |
| 18 | Build-Limits und Bezahlfunktionen (GDevelop), Abo-Modell (Construct 3), Preise und Lizenzentscheidungen (Unity) | Alles kostenlos und lokal, keine Limits, keine Konto-Pflicht, Open Source | alle |
| 19 | Läuft nur im Browser, keine Offline-Version (Construct 3) | Desktop-App, die offline läuft, dieselbe Oberfläche im Browser | 0, 9 |
| 20 | Fühlt sich bei fortgeschrittenen Projekten begrenzt an (GDevelop, Construct 3, Stencyl) | Code-Block für JavaScript, eigene Komponenten aus Blöcken, Code-Ansicht als Ausstieg | 5, 7 |
| 21 | Veraltete Tutorials und Oberfläche (Unity) | Doku und Blockhilfe werden automatisch aus den Blockdefinitionen erzeugt; eingebautes Tutorial | 11 |
| 22 | Erweiterungs-System kompliziert oder inkompatibel (Construct 3, TurboWarp, PenguinMod) | Einfache, versionierte Erweiterungs-API | später |
| 23 | Kaum noch aktive Entwicklung, ein einzelner Entwickler (Stencyl) | Modulare Architektur, gute Doku, damit andere beitragen können | alle |

Zusätzliche Verbesserungen gegenüber Unity (bekannte Ärgernisse aus der Praxis):
- Änderungen im Play-Modus gehen beim Stoppen verloren → wie in Unity zurücksetzen, aber mit Knopf „Diesen Wert behalten“ neben jedem geänderten Wert.
- Szenen werden nicht automatisch gespeichert → Blockwerk speichert automatisch und führt einen Versionsverlauf.

---

## 4. Grundprinzipien

1. **Erster Erfolg in 2 Minuten.** Neues Projekt öffnen, Boden und Spielerfigur sind da, Block-Skript anhängen, „Wenn Taste W gehalten → gehe vorwärts“ zusammenstecken, Play drücken, Figur läuft.
2. **Unity-Wissen gilt.** Was ein Unity-Tutorial über Szenen, Objekte, Komponenten, Prefabs, Licht oder Physik erklärt, funktioniert in Blockwerk gleich. Nur das Skripten ist anders.
3. **Erst schön, dann komplex.** Schon das leere Projekt sieht gut aus: Himmel, Licht, Schatten, texturierter Boden.
4. **Keine Wände.** Alles, was Spiele brauchen, ist eine Komponente oder ein normaler Block.
5. **Blöcke sind die Wahrheit.** Code-Ansicht und KI erzeugen oder zeigen Blöcke, sie ersetzen sie nie heimlich.
6. **Fehler sind verständlich.** Jede Meldung auf Deutsch, in Alltagssprache, mit Sprung zum Block oder Objekt.
7. **Dein Projekt gehört dir.** Lokale, lesbare Dateien, Git-freundlich, Export ohne Konto.

---

## 5. Editor (Unity-ähnlich)

### 5.1 Begriffe: Unity → Blockwerk

Die englische Oberfläche verwendet die aus Unity bekannten Begriffe. Die deutsche Oberfläche verwendet diese Übersetzungen:

| Unity | Blockwerk (Deutsch) | Unterschied |
|---|---|---|
| GameObject | Objekt | – |
| Component | Komponente | – |
| Transform | Transform | – |
| MonoBehaviour / C#-Skript | **Block-Skript** | Blöcke statt C#; öffentliche Variablen erscheinen im Inspektor wie bei Unity |
| Prefab, Prefab Variant, Nested Prefab | Prefab, Prefab-Variante, verschachteltes Prefab | – |
| Scene | Szene | Datei ist lesbares JSON |
| Hierarchy, Scene View, Game View, Inspector, Project, Console | Hierarchie, Szene, Spiel, Inspektor, Projekt, Konsole | – |
| Play Mode | Play-Modus | „Diesen Wert behalten“, isoliert vom Editor |
| Asset Store / Package Manager | Asset-Bibliothek | eingebaut, offline, nur CC0 |
| Tag, Layer | Tag, Ebene | – |
| Rigidbody, Collider, Character Controller | Rigidbody, Collider, Charakter-Controller | – |
| Animator | Animator (vereinfacht) | automatische Zuordnung statt Zustandsdiagramm |
| NavMesh, NavMesh Agent | Navigationsnetz, Nav-Agent | – |
| Canvas, RectTransform | UI-Leinwand, Anker | – |
| Input Actions | Eingabe-Aktionen | – |
| Lighting Window | Beleuchtung | – |
| Profiler | Profiler | – |
| Build Settings, Project Settings | Build-Einstellungen, Projekteinstellungen | – |
| *(gibt es nicht)* | **Bereichs-Reiter** | eigene Ergänzung, siehe 5.3 |
| *(gibt es nicht)* | **Testgelände** | eigene Ergänzung, siehe 5.6 |
| *(gibt es nicht)* | **Figuren-Studio** | eigene Ergänzung, siehe 5.10 |

### 5.2 Fensteraufbau (Standard-Layout)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Datei Bearbeiten Assets Objekt Komponente Fenster Hilfe                      │
│ [✋][✥][⟳][⤢][▭][⊕]  Pivot│Global      ▶  ⏸  ⏭        Ebenen ▾  Layout ▾  KI │
├──────────────────────────────────────────────────────────────────────────────┤
│ [Alle][Umgebung][Spieler 1][Spieler 2][NPCs][Gegenstände][UI][+]             │
├───────────────┬─────────────────────────────────────────┬────────────────────┤
│ Hierarchie    │ [Szene][Spiel][Block-Editor]            │ Inspektor          │
│ ▾ Umgebung    │                                         │ ☑ Held  Tag ▾ Ebene▾│
│   Sonne       │                                         │ ▾ Transform        │
│   Gelände     │          3D-Ansicht                     │ ▾ Modell-Renderer  │
│ ▾ Spieler 1   │     (Gizmos, Raster, Achsenwürfel)      │ ▾ Charakter-Contr. │
│   Held        │                                         │ ▾ Third-Person-Kam.│
│ ▾ NPCs        │                                         │ ▾ Block-Skript     │
│   Händler     │                                         │   Laufgeschw. 4.5  │
│   Wache (3)   │                                         │ [Komponente hinzuf.]│
├───────────────┴───────────────────────┬─────────────────┴────────────────────┤
│ [Projekt][Asset-Bibliothek][Konsole]  │                                      │
│ ▸ Assets  ▸ Szenen ▸ Prefabs ▸ Block-Skripte ▸ Modelle ▸ Materialien ▸ Klänge │
└──────────────────────────────────────────────────────────────────────────────┘
```

- In den Bereichen Spieler 1, Spieler 2 und NPCs steht in der Mitte zusätzlich der Reiter **Figur** (Figuren-Studio, 5.10) an erster Stelle.
- Alle Fenster sind andockbar, als Reiter gruppierbar, abtrennbar (zweiter Bildschirm) und verschiebbar. Layouts lassen sich speichern („Standard“, „Blöcke gross“, „Zwei Bildschirme“).
- Werkzeugleiste oben wie in Unity: Hand, Verschieben, Drehen, Skalieren, Rechteck, Kombi-Werkzeug; Pivot/Mitte und Lokal/Global; Play, Pause, Einzelbild in der Mitte; rechts Ebenen-Sichtbarkeit, Layout-Auswahl, KI-Assistent.
- Standardmässig dunkles Design, helles Design wählbar.

### 5.3 Bereichs-Reiter

Die Reiterleiste unter der Werkzeugleiste ordnet das Projekt nach Bereichen. Technisch ist jeder Bereich ein **Wurzel-Objekt in der Hierarchie** (so, wie erfahrene Unity-Nutzer ihre Szenen mit leeren Ordner-Objekten gliedern). Ein Klick auf einen Reiter filtert Hierarchie, Szenen-Hervorhebung, Projekt-Fenster und die Blockpalette auf diesen Bereich. „Alle“ zeigt alles wie in Unity.

| Reiter | Inhalt | Blockkategorien oben in der Palette |
|---|---|---|
| **Umgebung** | Gelände, Himmel, Sonne und Licht, Wetter, Tageszeit, Wasser, Gebäude, Pflanzen, Musik | Umgebung, Licht, Klang |
| **Spieler 1** | Spielerfigur (gestaltet im Figuren-Studio), Steuerung, Kamera, Lebenspunkte, Inventar | Spieler, Bewegung, Kamera, Animation |
| **Spieler 2** | Zeigt zuerst „Spieler 2 aktivieren“; danach zweite Figur, Wahl zwischen geteiltem Bildschirm und gemeinsamer Kamera, Steuerung (Gamepad 2 oder zweite Tastenbelegung) | wie Spieler 1 |
| **NPCs** | NPC-Prefabs (Dorfbewohner, Händler, Wache, Zombie …) und ihre Exemplare in der Welt, Dialoge | NPC und KI, Dialog, Bewegung, Animation |
| **Gegenstände** | Münzen, Schlüssel, Truhen, Türen, Waffen, Fahrzeuge, Schalter | Gegenstände, Physik |
| **UI** | HUD, Hauptmenü, Pausemenü, Einstellungen | UI, Szenen, Speichern |
| **+ Eigener Reiter** | frei benennbar, z. B. „Quests“, „Bosskampf“ | frei wählbar |

- Reiter umbenennen, umsortieren, einfärben, ausblenden. Neue Objekte landen im aktiven Bereich.
- Das Wurzel-Objekt eines Bereichs kann selbst Block-Skripte tragen (z. B. „Wenn Spiel startet → setze Tageszeit auf 8 Uhr“ im Bereich Umgebung), wie ein „Manager“-Objekt in Unity.
- Andere Bereiche lassen sich in der Szene ausblenden oder halbtransparent zeigen.

### 5.4 Szene (Szenen-Ansicht)

Bedienung wie in Unity:
- Rechte Maustaste halten + WASD fliegen, Q/E runter/hoch, Shift schneller; Alt + linke Maustaste umkreisen; mittlere Maustaste verschieben; Mausrad zoomen; `F` oder Doppelklick in der Hierarchie fokussiert.
- Achsenwürfel oben rechts: Klick auf Achse wechselt in Vorder-, Seiten-, Draufsicht; Umschalten perspektivisch/orthografisch.
- Gizmos für Verschieben, Drehen, Skalieren, Kombi-Werkzeug. Einrasten mit `Strg`, Einrasten an Eckpunkten mit `V`, „An Oberfläche ausrichten“.
- Darstellungsoptionen: schattiert, Drahtgitter, Licht an/aus, Gizmos an/aus, Himmel und Nebel an/aus, Kamerageschwindigkeit.
- Assets aus Projekt-Fenster oder Asset-Bibliothek hineinziehen: Objekt setzt auf die Oberfläche unter dem Mauszeiger auf.
- Pinsel zum Verteilen vieler Objekte (Bäume, Steine, Gras) mit zufälliger Drehung und Grösse.
- Gelände-Werkzeuge im Inspektor der Gelände-Komponente (heben, senken, glätten, ebnen, Textur malen, Pflanzen malen), wie bei Unity.
- Einblendbar: Collider, Trigger-Zonen, Navigationsnetz, Lichtreichweite, Kamera-Sichtfeld, Wegpunkte.

### 5.5 Spiel (Spielansicht) und Play-Modus

- Play (`Strg+P`), Pause (`Strg+Shift+P`), Einzelbild (`Strg+Alt+P`) wie in Unity. Beim Start wechselt der Editor in die Spielansicht (Option „Beim Spielen maximieren“), der Editor wird während des Spiels farbig getönt.
- Spielansicht-Leiste: Seitenverhältnis/Auflösung, Grafikstufe, Ton aus, Statistik-Einblendung (FPS, Draw Calls, Dreiecke), Gizmos.
- Während des Spiels kann man in Szene und Inspektor alles ansehen und Werte ändern. Beim Stoppen wird wie in Unity alles zurückgesetzt. **Verbesserung:** Neben jedem geänderten Wert erscheint „Diesen Wert behalten“; ausserdem „Alle Änderungen dieses Objekts behalten“ per Rechtsklick.
- Blockänderungen während des Spiels werden sofort übernommen (Hot Reload).
- „Von hier spielen“: startet Spieler 1 an der aktuellen Position der Szenen-Kamera.
- Zeitlupe (0,25×, 0,5×) zusätzlich zu Pause und Einzelbild.
- Der Play-Modus läuft isoliert: Fehler im Spiel stoppen höchstens das Spiel, nie den Editor.

### 5.6 Testgelände

- Eingebaute Testszene, die nie Teil des Spiels wird. Start über „Im Testgelände spielen“ (Menü Fenster und Kontextmenü eines Spieler-Objekts).
- Enthält: Boden mit Meter-Raster und Beschriftung, Treppen mit verschiedenen Stufenhöhen, Rampen mit 15°, 30° und 45°, Sprunglücken mit steigender Breite, bewegliche Plattform, Stapel Physik-Kisten, Wasserbecken, Leiter, enge Gänge, eine NPC-Puppe, Zielscheiben.
- Das gewählte Spieler-Objekt (mit allen Komponenten und Block-Skripten) wird dort hineingesetzt. So lassen sich Steuerung, Sprunghöhe, Kamera und Animation testen, ohne die eigene Szene anzufassen.
- Werte wie Laufgeschwindigkeit oder Sprungkraft im Inspektor ändern und mit „Diesen Wert behalten“ ins eigentliche Objekt übernehmen.

### 5.7 Inspektor

Wie in Unity:
- Kopfzeile: Aktiv-Häkchen, Name, Tag, Ebene, Statisch.
- Komponenten untereinander, jede mit Aktiv-Häkchen, aufklappbar, Kontextmenü (Zurücksetzen, Werte kopieren, Werte einfügen, Entfernen, nach oben/unten).
- **Komponente hinzufügen** mit Suchfeld und Kategorien.
- Mehrere Objekte gleichzeitig bearbeiten, unterschiedliche Werte werden als „—“ angezeigt.
- Objekt- und Asset-Verweise per Drag-and-Drop aus Hierarchie oder Projekt in Felder ziehen.
- Prefab-Exemplare: überschriebene Werte fett mit Markierung am Rand, „Übernehmen“ und „Zurücksetzen“ pro Wert und für alles.
- Bei ausgewähltem Asset zeigt der Inspektor dessen Import-Einstellungen (Massstab, Collider erzeugen, Animationen zuordnen, Materialien).

### 5.8 Projekt-Fenster und Asset-Bibliothek

- **Projekt:** Ordnerbaum links, Inhalte rechts mit Vorschaubildern, Grössenregler, Suche, Filter nach Typ, Favoriten. Ordner `Assets/` mit Unterordnern wie in Unity üblich (Szenen, Prefabs, Block-Skripte, Modelle, Materialien, Texturen, Klänge, UI).
- Rechtsklick „Erstellen“: Szene, Prefab, Block-Skript, Material, Ordner, Eingabe-Aktionen, Dialog, Partikel-Vorlage.
- **Asset-Bibliothek:** eigener Reiter neben Projekt, Inhalt siehe Abschnitt 6. Objekte direkt in die Szene ziehen oder „In Projekt importieren“.

### 5.9 Block-Editor

- Andockbares Fenster (standardmässig als Reiter neben Szene und Spiel). Öffnet sich per Doppelklick auf eine Block-Skript-Komponente im Inspektor oder auf ein Block-Skript im Projekt-Fenster, genau wie Unity bei Doppelklick auf ein Skript den Code-Editor öffnet.
- Kopfzeile zeigt, welches Block-Skript und welches Objekt bearbeitet wird.
- Innen Scratch-Aufbau: Blockpalette links (Kategorien, oben die zum Bereich passenden), Skriptbereich in der Mitte, Variablen-Liste rechts.
- Objekte aus der Hierarchie lassen sich direkt auf Block-Steckplätze ziehen („gehe zu [Brunnen]“).
- Im Play-Modus leuchten laufende Skripte.
- Wer mehr Platz will, nimmt das Layout „Blöcke gross“ oder trennt das Fenster auf einen zweiten Bildschirm ab.
- Details zum Blocksystem in Abschnitt 7.

### 5.10 Figuren-Studio

Eine grafische Ansicht für alles, was eine Figur ausmacht. In den Bereichen Spieler 1, Spieler 2 und NPCs ist sie der erste Reiter neben Szene, Spiel und Block-Editor. Die Logik bleibt im Block-Editor; Aussehen, Animationen, Bewegungsgefühl und Fähigkeiten werden hier mit der Maus gestaltet. Das Studio ist eine grafische Oberfläche über denselben Komponenten, die auch im Inspektor stehen.

```
┌──────────────────────────────────────────────────────────────────────────┐
│ [Figur][Szene][Spiel][Block-Editor]     Figur: Held ▾   [Im Testgelände ▶] │
├────────────────┬────────────────────────────────────────┬────────────────┤
│ Modell         │                                        │ Animationen    │
│ Baukasten      │        Drehbühne (3D-Vorschau)         │ ▶ Stehen   ✓   │
│ Farben         │   Studiolicht, Meter-Raster,           │ ▶ Gehen    ✓   │
│ Ausrüstung     │   Vergleichsfigur, Sprungbogen,        │ ▶ Rennen   ✓   │
│ Bewegung       │   Kollisions-Kapsel                    │ ▶ Springen ✓   │
│ Kollision      │                                        │ ▶ Rollen   +   │
│ Klänge         │  [Stehen][Gehen][Rennen][Springen] 🐢  │ Kamera-Vorschau│
│ Porträt        │                                        │ [   Bild   ]   │
├────────────────┴────────────────────────────────────────┴────────────────┤
│ Fähigkeiten: [Doppelsprung][Sprinten][Rollen][Schwimmen][Klettern][Gleiten][+] │
└──────────────────────────────────────────────────────────────────────────┘
```

**1. Modell wählen oder hochladen**
- Animierte Figuren aus der Asset-Bibliothek mit einem Klick übernehmen.
- Eigenes Modell per Drag-and-Drop auf die Drehbühne: GLB/glTF, FBX, OBJ und **VRM** (Avatar-Format, z. B. aus dem kostenlosen VRoid Studio).
- Automatische Skelett-Erkennung: Ein menschliches Skelett wird auf das interne Standard-Skelett zugeordnet (Kopf, Wirbelsäule, Arme, Hände, Beine, Füsse). Die Zuordnung wird auf einer Figur-Silhouette angezeigt und lässt sich per Klick korrigieren.
- **Animations-Übertragung:** Alle Standard-Animationen der Bibliothek funktionieren auf jedem zugeordneten menschlichen Skelett. Ein hochgeladenes Modell kann damit sofort stehen, gehen, rennen, springen, ohne eigene Animationen.
- Modell ohne Skelett (z. B. Roboterkugel, Auto, Schleim): wird als starre Figur verwendet, Bewegung wirkt trotzdem lebendig durch automatisches Wippen beim Laufen, Neigen in Kurven und Stauchen beim Landen.
- Massstab automatisch auf eine wählbare Körpergrösse (Standard 1,8 m), Vergleichsfigur auf der Drehbühne.

**2. Figuren-Baukasten**
- Figur aus Teilen zusammenstellen, auf Basis modularer CC0-Figuren mit gemeinsamem Skelett (z. B. Quaternius Universal Base Characters und Modular Character Outfits): Körper, Kopf, Haare, Oberteil, Hose, Schuhe, Handschuhe, Hut, Rucksack.
- Farbwähler pro Teil (Haut, Haare, Augen, Kleidung) mit fertigen Paletten und Zufallsknopf 🎲.
- Körper-Regler: Grösse, Statur, Kopfgrösse, Arm- und Beinlänge (über Knochen-Skalierung, nur soweit das Modell es sauber zulässt).

**3. Ausrüstung und Halte-Punkte**
- Halte-Punkte an Knochen: rechte Hand, linke Hand, Rücken, Kopf, Hüfte, plus eigene.
- Gegenstände aus der Bibliothek (Schwert, Fackel, Hut, Laterne) per Drag-and-Drop auf die Figur ziehen. Sie rasten am nächsten Halte-Punkt ein, lassen sich mit Gizmo fein ausrichten und folgen der Animation.
- Im Spiel per Block wechselbar („hänge [Schwert] an [rechte Hand]“).

**4. Animationen**
- Liste der Standardzustände: ✓ vorhanden, + fehlt (aus der Bibliothek wählen oder eigene hochladen).
- Jede Animation auf der Drehbühne abspielen, mit Geschwindigkeit, Überblendzeit, Schleife, Zeitlupe.
- Kleine Zeitleiste für Animations-Ereignisse: Fuss setzt auf → Schrittgeräusch, Schlag-Moment → Schaden.
- Eigene Animationen (GLB/FBX) werden auf das Skelett übertragen.

**5. Bewegung mit Live-Vorschau**
- Regler: Gehgeschwindigkeit, Renngeschwindigkeit, Beschleunigung, Drehgeschwindigkeit, Sprunghöhe, Luftsteuerung, Schwerkraft-Faktor, maximale Steigung, Stufenhöhe.
- Der **Sprungbogen** wird live auf der Drehbühne eingezeichnet (Höhe und Weite in Metern), daneben Vergleichs-Hindernisse (Stufe, Kiste, Lücke), damit man sofort sieht, was die Figur schafft.
- **Bewegungs-Profile** als Voreinstellung: Arcade (direkt, hohe Sprünge), Realistisch (träge, schwer), Flink (Ninja), Schwer (Ritter in Rüstung), Schwebend (Geist). Profil wählen → alle Regler und passende Animations-Geschwindigkeiten werden gesetzt.
- Knopf „Im Testgelände ▶“ startet sofort das Testgelände mit genau dieser Figur.

**6. Fähigkeiten-Karten**
- Fähigkeiten als Karten mit kleiner animierter Vorschau, per Drag-and-Drop auf die Figur: Doppelsprung, Sprinten mit Ausdauer, Rollen/Ausweichen, Ducken, Schwimmen, Klettern (Leitern), Gleiten, Wandsprung, Hechtsprung, Aufheben und Tragen, Interagieren.
- Jede Karte fügt die nötige Komponente hinzu, belegt eine Eingabe-Aktion vor, prüft fehlende Animationen (mit Vorschlag aus der Bibliothek) und bringt eigene Blöcke mit („Wenn ich rolle“, „setze Ausdauer auf ( )“).
- Karten lassen sich ein- und ausschalten und in der Reihenfolge der Priorität sortieren.

**7. Kollision**
- Kollisions-Kapsel wird automatisch an die Figur angepasst, ist auf der Drehbühne sichtbar und mit Anfassern in Höhe, Radius und Versatz verstellbar.

**8. Klänge und Stimme**
- Klang-Sets für Schritte (pro Untergrund), Sprung, Landung, Schmerz, Sieg. Vorhören, aus der Bibliothek wählen oder hochladen.

**9. Kamera-Vorschau**
- Kleines Fenster zeigt, wie die Spielkamera die Figur sieht. Abstand, Höhe und Schulter-Versatz direkt im Vorschaubild mit der Maus ziehen.

**10. Porträt**
- „Porträt erstellen“: rendert ein Brustbild in wählbarer Pose, Blickwinkel und Hintergrund. Wird als Bild gespeichert und kann im HUD, in Menüs, Dialogen und bei Spielständen verwendet werden.

**11. Spieler 2 und NPCs**
- „Wie Spieler 1, aber andere Farben“ erstellt Spieler 2 als Prefab-Variante mit neuer Farbpalette.
- NPCs nutzen dasselbe Studio, zusätzlich mit NPC-Feldern (Name über dem Kopf, Dialog, Verhalten).
- Jede Figur ist ein Prefab. „In Meine Figuren speichern“ legt sie in die Asset-Bibliothek für andere Projekte.

**Technik:** Internes Standard-Skelett nach den menschlichen Knochennamen des VRM-Standards. Import über die Three.js-Lader und `@pixiv/three-vrm`, Übertragung von Animationen per Retargeting auf dieses Standard-Skelett. Lizenzangaben in VRM-Dateien werden ausgelesen und im Lizenzfeld des Assets angezeigt.

### 5.11 Weitere Fenster (Menü „Fenster“)

- **Beleuchtung:** Himmel, Umgebungslicht, Nebel, Sonne, Tageszeit.
- **Navigation:** Navigationsnetz berechnen, Agent-Grösse, begehbare Ebenen.
- **Eingabe-Aktionen:** Aktionen und Belegung pro Spieler.
- **Animator (vereinfacht):** Animations-Zuordnung einer Figur, Überblendzeiten, Vorschau.
- **Dialog-Editor**, **UI-Editor** (Leinwand mit Ankern wie Unity).
- **Profiler:** Bildzeit, Skripte, Physik, Rendern, Draw Calls.
- **Build-Einstellungen:** Szenenliste, Plattform, Build.
- **Projekteinstellungen:** Tags und Ebenen, Physik-Ebenen-Matrix, Schwerkraft, Grafikstufen, Zeit, Spielname und Symbol.

### 5.12 Allgemein

- Rückgängig/Wiederholen über alles, mit Verlaufsliste.
- Automatisches Speichern plus lokaler Versionsverlauf (Schnappschüsse, wiederherstellbar).
- Zoom der Oberfläche, Modus „grosse Blöcke“, hoher Kontrast, komplette Tastaturbedienung.
- Sprache Deutsch und Englisch umschaltbar. Das gespeicherte Projekt ist sprachunabhängig.

### 5.13 Tastenkürzel (wie Unity, ergänzt)

| Kürzel | Funktion |
|---|---|
| `Q` / `W` / `E` / `R` / `T` / `Y` | Hand / Verschieben / Drehen / Skalieren / Rechteck / Kombi |
| `F` | Auswahl fokussieren |
| `Strg+D` | Duplizieren |
| `F2` | Umbenennen (Hierarchie, Projekt) bzw. Überall umbenennen (Block-Editor) |
| `Entf` | Löschen |
| `Strg+Shift+N` | Neues leeres Objekt |
| `Strg+Shift+F` | Objekt an Ansicht ausrichten |
| `Strg+P` / `Strg+Shift+P` / `Strg+Alt+P` | Play / Pause / Einzelbild |
| `Strg+S` | Szene speichern |
| `Strg+1` … `Strg+5` | Szene / Spiel / Inspektor / Hierarchie / Projekt fokussieren |
| `Alt+1` … `Alt+9` | Bereichs-Reiter wechseln |
| `Strg+Z` / `Strg+Y` | Rückgängig / Wiederholen |
| Im Block-Editor: `/` oder lostippen | Block suchen und einfügen |
| Im Block-Editor: `F12` / `Shift+F12` | Gehe zu Definition / Alle Verwendungen |
| Im Block-Editor: `F9` / `F10` | Haltepunkt setzen / Einzelschritt |

---

## 6. Asset-Bibliothek und Prefabs

### 6.1 Aufbau

**Kategorien:** Grundformen · Natur (Bäume, Steine, Pflanzen) · Gelände und Wasser · Gebäude und Bausätze (modulare Wände, Böden, Dächer) · Innenräume und Möbel · Figuren (animiert) · Tiere · Fahrzeuge · Gegenstände (Münzen, Truhen, Schlüssel, Waffen, Werkzeuge) · Dungeon · Sci-Fi · Effekte (Partikel-Vorlagen) · Materialien und Texturen · Himmel (HDRI) · Klänge · Meine Prefabs.

**Pro Eintrag gespeichert:** Vorschaubild, Name (de/en), Tags, Kategorie, Lizenz, Quelle, Urheber, Polygonanzahl, Grösse in Metern, vorgeschlagener Collider, bei Figuren die Animationen und ihre Zuordnung.

**Bedienung:** unscharfe Suche (de/en), Filter (Kategorie, animiert, Polygonanzahl), Favoriten, zuletzt benutzt, Vorschau mit drehbarem 3D-Modell, direkt in die Szene ziehen. Grundformen (Würfel, Kugel, Zylinder, Kapsel, Ebene, Rampe, Treppe) gibt es auch im Menü „Objekt“ wie in Unity.

### 6.2 Startpaket

- Mitgeliefert werden **nur CC0-lizenzierte** Modelle, Texturen und Himmel, damit jedes Spiel ohne Namensnennung und kommerziell veröffentlicht werden darf.
- Quellen: Kenney, Quaternius, KayKit (freie Pakete) und Poly Haven (Modelle, Texturen, HDRI-Himmel). Quaternius und KayKit liefern auch geriggte, animierte Figuren.
- Umfang siehe Anhang C.
- `pnpm assets:fetch` lädt die Pakete von den offiziellen Quellen, prüft die Lizenz, wandelt alles in optimiertes GLB um (Meshopt, komprimierte Texturen), normalisiert Massstab und Drehpunkt, rendert Vorschaubilder und schreibt `library/index.json` samt `LICENSES.md`.
- Jedes Paket hat in `packages/library/sources/` eine Beschreibung (URL, Lizenz, Kategorien, Zuordnung der Animationsnamen). Neue Pakete werden nur über diese Beschreibungen aufgenommen.

### 6.3 Eigene Modelle importieren

- Wie in Unity: Datei ins Projekt-Fenster ziehen. glTF/GLB direkt, FBX und OBJ werden beim Import in GLB umgewandelt.
- Import-Einstellungen im Inspektor: Massstab (mit Vergleichsfigur 1,8 m), Drehpunkt, Collider erzeugen, Animationen zuordnen, Materialien.
- Lizenzfeld pro importiertem Asset. Der Export listet alle Fremd-Assets mit Lizenz.
- Mixamo-Figuren und -Animationen darf der Nutzer in sein eigenes Projekt importieren. Sie werden nie in die mitgelieferte Bibliothek aufgenommen, weil die Rohdateien nicht weitergegeben werden dürfen.

### 6.4 Prefabs

Wie in Unity:
- Objekt aus der Hierarchie ins Projekt-Fenster ziehen = Prefab erstellen. Prefab-Exemplare sind in der Hierarchie blau markiert.
- Prefab-Modus: Doppelklick öffnet das Prefab isoliert zum Bearbeiten. Änderungen wirken auf alle Exemplare.
- Überschreibungen pro Exemplar, „Übernehmen“ und „Zurücksetzen“ im Inspektor.
- **Prefab-Varianten** für Vererbung (`Gegner` → `Zombie`, `Skelett`): erben Komponenten, Block-Skripte und Werte, können alles überschreiben.
- Verschachtelte Prefabs.
- Prefabs lassen sich unter „Meine Prefabs“ in die Asset-Bibliothek legen und in allen eigenen Projekten nutzen (mit allen Abhängigkeiten).

---

## 7. Blocksystem

### 7.1 Block-Skripte als Komponenten

- Ein **Block-Skript** ist ein Asset im Projekt-Fenster (wie eine C#-Datei in Unity) und wird als Komponente an ein oder mehrere Objekte gehängt. Ein Objekt kann mehrere Block-Skripte haben.
- Variablen eines Block-Skripts können als **„im Inspektor zeigen“** markiert werden. Sie erscheinen dann als Feld in der Komponente und können pro Objekt verschieden eingestellt werden (wie öffentliche Felder in Unity). Typen: Zahl, Text, Wahrheitswert, Farbe, Position, Objekt-Verweis, Asset-Verweis, Liste.
- Ereignis-Blöcke entsprechen den bekannten Unity-Ereignissen: „Wenn Spiel startet“ (Start), „Jeden Frame“ (Update), „Wenn ich berühre“ (Kollision), „Wenn Zone betreten“ (Trigger), „Wenn ich zerstört werde“ (OnDestroy).
- Damit werden Block-Skripte zu **eigenen Komponenten**: Ein Block-Skript „Patrouille“ mit den Inspektor-Feldern Geschwindigkeit und Wegpunkte lässt sich an beliebige NPCs hängen.

### 7.2 Blockformen

| Form | Bedeutung | Beispiel |
|---|---|---|
| Hut | Ereignis, startet ein Skript | Wenn Taste [W] gehalten |
| Stapel | Befehl | gehe (2) Meter vorwärts |
| Rund | Wert | (Höhe) |
| Spitz | Bedingung | <stehe ich auf dem Boden?> |
| Klammer | Steuerstruktur mit Inhalt | wiederhole (10) mal |
| Kappe | Ende eines Skripts | zerstöre dich |

### 7.3 Datentypen

Zahl, Text, Wahrheitswert, Liste, Wörterbuch, Objekt-Verweis, Asset-Verweis, Position/Richtung (3D-Vektor), Farbe.

- Steckplätze zeigen ihren Typ durch Form und Farbe. Zahl und Text werden automatisch umgewandelt, alles andere beim Bearbeiten geprüft.
- Auswahllisten (Objekte, Animationen, Klänge, Aktionen, Tags) füllen sich automatisch aus Szene und Projekt.

### 7.4 Variablen

Gültigkeitsbereiche: Spiel (global), Szene, Objekt (pro Exemplar, optional im Inspektor), lokal (nur im Skript). Jede Variable kann als „wird gespeichert“ markiert werden (für Spielstände). Im Play-Modus als Anzeige einblendbar.

### 7.5 Gruppen

Gruppen über Tags (wie in Unity): `Gegner`, `Einsammelbar`, `Begehbar`. Tags funktionieren in Kollisions-, Such- und Schleifenblöcken („für jedes Objekt mit Tag [Gegner]“).

### 7.6 Eigene Blöcke (Funktionen)

- Befehl, Wert (mit „gib zurück“), Bedingung. Typisierte, veränderbare Parameter.
- Option „ohne Bildschirmaktualisierung ausführen“.
- Gültig im Block-Skript oder projektweit (Block-Bibliothek im Projekt-Fenster).
- Rechtsklick auf markierte Blöcke → „Als eigenen Block auslagern“.

### 7.7 Nachrichten

- `sende [Nachricht] mit Wert ( ) an [alle | Bereich | Tag | Objekt]`
- `sende … und warte`. Der Empfangs-Hut stellt Wert und Absender bereit.
- Diagnose meldet Nachrichten ohne Empfänger und umgekehrt.

### 7.8 Tastatur-Eingabe, Navigation, Ordnung

- Im Skriptbereich tippen öffnet eine unscharfe Suche über alle Blöcke (de/en, mit Synonymen). `Enter` fügt ein, `Tab` springt zum nächsten Feld.
- Ausdrücke direkt tippen: `x/2 + 10` wird zu Operator-Blöcken.
- Projektweite Suche, „Gehe zu Definition“, „Alle Verwendungen“, „Überall umbenennen“.
- Skripte einklappen, Kommentare, farbige Bereiche, Minimap, „Aufräumen“.

### 7.9 Code-Ansicht und Code-Block

- Umschalter zeigt das erzeugte JavaScript eines Skripts, nur lesend, mit Verknüpfung Block ↔ Zeile.
- **Code-Block** für Fortgeschrittene mit dokumentierter API (`self`, `game`, `scene`, `three`), wird nie automatisch umgeschrieben.

### 7.10 Eine Quelle für alle Blöcke

```ts
defineBlock({
  id: 'motion.moveForward',
  category: 'motion',
  shape: 'stack',
  inputs: { meters: { type: 'number', default: 1 } },
  text: { de: 'gehe {meters} Meter vorwärts', en: 'move {meters} m forward' },
  keywords: { de: ['laufen', 'bewegen', 'vor'], en: ['walk', 'move'] },
  areas: ['player', 'npc'],          // steht in diesen Bereichen oben in der Palette
  compile: ({ meters }) => `self.moveLocal(0, 0, ${meters});`,
  docs: { de: 'Bewegt das Objekt in Blickrichtung.', en: 'Moves the object along its facing direction.' },
  since: 1,
});
```

Daraus werden erzeugt: Blockly-Definitionen, Compiler-Zuordnung, Palette pro Bereich, Suchindex, Dokumentation und der Blockkatalog für den KI-Assistenten. Der Startkatalog steht in Anhang A.

---

## 8. Laufzeit (3D-Engine)

### 8.1 Spielschleife

- Feste Logikrate 60 Hz, Rendern mit der Bildwiederholrate, Interpolation von Positionen und Drehungen.
- Reihenfolge pro Logik-Tick (dokumentieren und testen): Eingabe → Timer → Komponenten (vor Skripten) → Block-Skripte → Charakter-Controller → Physik-Schritt → Kollisions- und Trigger-Ereignisse → Erzeugen/Zerstören → Animation → Kamera → Audio-Positionen. Danach Rendern mit Post-Processing.

### 8.2 Skript-Ausführung

- Blöcke werden zu Generator-Funktionen kompiliert (Anhang B). Ein Scheduler führt alle Threads kooperativ aus.
- Schleifen geben am Ende jeder Wiederholung den Frame ab, ausser in eigenen Blöcken mit „ohne Bildschirmaktualisierung“. `warte`-Blöcke sind `yield`-Punkte.
- Feste, dokumentierte Ausführungsreihenfolge (wie Unitys Script Execution Order, im Projekt einstellbar).
- Wird ein Objekt zerstört oder die Szene gewechselt, enden seine Threads sauber.
- Endlosschleifen ohne Frame-Abgabe werden nach einem Zeitlimit abgebrochen und als Fehler mit Block-Verweis gemeldet.

### 8.3 Grafik

- Three.js mit WebGL2, physikbasierte Materialien (PBR, Metallic/Roughness wie Unitys Standard-Shader), lineares Farbmanagement.
- Licht: Sonne (gerichtetes Licht) mit kaskadierten Schatten, Punkt- und Spotlichter, Umgebungslicht aus dem Himmel.
- Himmel: HDRI-Himmel oder berechneter Himmel mit Sonnenstand, Nebel.
- Post-Processing als Komponente an der Kamera (wie Unitys Volume): Tone-Mapping, Bloom, Umgebungsverdeckung, Kantenglättung, Farbkorrektur, Vignette, optional Tiefenunschärfe.
- **Grafikstufen** Niedrig / Mittel / Hoch / Ultra in den Projekteinstellungen und im exportierten Spiel umschaltbar.
- Leistung: automatische Instanziierung gleicher Modelle, Detailstufen (LOD), Sichtbarkeitsprüfung, komprimierte Texturen, BVH für Raycasts.

### 8.4 Physik

- Rapier3D. Komponenten wie in Unity: Rigidbody (dynamisch, kinematisch), Collider (Box, Kugel, Kapsel, Zylinder, konvexe Hülle, Mesh), Häkchen „Ist Trigger“, Physik-Material (Reibung, Abprallen).
- Physik-Ebenen-Matrix in den Projekteinstellungen, Schwerkraft pro Szene.
- Kräfte, Impulse, Raycasts als Blöcke.

### 8.5 Spielerfiguren

- Komponente **Charakter-Controller** auf Basis von Rapiers kinematischem Charakter-Controller: Rampen bis zu einem einstellbaren Winkel hochgehen, an zu steilen abrutschen, Treppen automatisch steigen, am Boden haften beim Bergab-Laufen, an Hindernissen entlanggleiten, dynamische Objekte schieben.
- Fertige Steuerungs-Komponenten darauf: Third-Person-Steuerung, First-Person-Steuerung, Draufsicht-Steuerung, Fahrzeug.
- Spielgefühl: Beschleunigung und Abbremsen, Drehung in Laufrichtung, Rennen, Ducken, Springen mit Sprung-Puffer und kurzer Gnadenfrist nach Kanten, einstellbare Sprunghöhe, Luftsteuerung, Landeerkennung.
- Alle Werte im Inspektor und per Block änderbar. Standardwerte erfüllen die Unity-Gefühl-Checkliste ohne Anpassung.

### 8.6 Kamera

- Komponente Kamera plus Kamera-Verhalten: Third-Person-Orbit, First-Person, Draufsicht, Seitenansicht, feste Kamera, Kamerafahrt (Wegpunkte).
- Third-Person: Maus und rechter Stick, Abstand und Höhe, Glättung, Kollision mit Wänden, Zoom per Mausrad.
- Kamerawackeln, Sichtfeld-Änderung beim Rennen, weiche Übergänge zwischen Kameras.
- **Spieler 2:** geteilter Bildschirm (waagrecht oder senkrecht) oder gemeinsame Kamera, die beide im Bild hält.

### 8.7 Animation

- Skelett-Animationen aus glTF und VRM. Komponente **Animator (vereinfacht)**.
- Internes Standard-Skelett (menschliche Knochennamen nach VRM-Standard). Animationen werden auf jedes zugeordnete menschliche Skelett übertragen (Retargeting), siehe Figuren-Studio (5.10).
- Automatische Zuordnung von Clip-Namen auf Standardzustände (Stehen, Gehen, Rennen, Springen, Fallen, Landen, Ducken, Angreifen, Treffer, Sterben, Winken …), abweichende Namen im Import-Inspektor zuordnen.
- Steuerungs-Komponenten bedienen die Standardzustände selbst, mit weicher Überblendung und Abspielgeschwindigkeit passend zur Laufgeschwindigkeit.
- Blöcke: „spiele Animation [Winken] einmal“, Überblendzeit, Animations-Ereignisse.
- Tweens für einfache Objekt-Animationen ohne Skelett.

### 8.8 NPCs

- Navigation mit Recast/Detour (WASM): Navigationsnetz im Fenster Navigation berechnen, automatische Neuberechnung bei Änderungen, Hindernisse. Komponente **Nav-Agent** wie in Unity.
- Fertige NPC-Komponenten: Herumwandern, Patrouille, Folgen, Fliehen, Wachen mit Sichtkegel und Hörweite, Angreifen (Nah/Fern), Ansprechbar.
- Zustände als Blöcke: „Wenn Zustand [Patrouille]“, „wechsle Zustand zu [Verfolgen]“. Im Play-Modus wird der Zustand über dem NPC angezeigt.
- Dialoge im Dialog-Editor (Text, Antworten, Bedingungen, Aktionen), Blöcke „starte Dialog [Händler]“, „Wenn Dialog-Antwort [Ja]“.
- Gruppen-Bewegung (Crowd), damit sich viele NPCs nicht blockieren.

### 8.9 Umgebung

- Gelände-Komponente mit Höhenkarte, Pinseln, bis zu 4 Texturschichten, Gras und Pflanzen per Instanziierung.
- Wasser mit Spiegelung und Wellen, Schwimmen als Option im Charakter-Controller.
- Tag-Nacht-Wechsel, Wetter (Regen, Schnee, Nebel, Wind), Umgebungsklänge pro Bereich.

### 8.10 Eingabe und Spieler 2

- Eingabe-Aktionen wie Unitys Input System: `Bewegen` (2D-Achse), `Umsehen`, `Springen`, `Rennen`, `Ducken`, `Interagieren`, `Angreifen`, `Pause` usw.
- Belegung pro Spieler: Spieler 1 z. B. WASD + Maus oder Gamepad 1, Spieler 2 z. B. Gamepad 2 oder Pfeiltasten + Ziffernblock.
- Mauszeiger im Spiel gefangen, `Esc` gibt ihn frei. Tastenbelegung im exportierten Spiel änderbar.

### 8.11 Audio

- Komponente Audio-Quelle mit 3D-Klang (Lautstärke und Richtung nach Entfernung), Audio-Listener an der Kamera.
- Musik mit Überblenden, getrennte Lautstärke für Musik, Effekte, Stimmen.
- Schrittgeräusche über Animations-Ereignisse, optional nach Untergrund.

### 8.12 UI und Menüs

- UI-Leinwand mit Ankern und Skalierung nach Auflösung (wie Unitys Canvas und RectTransform), bearbeitet im UI-Editor.
- Elemente: Text, Bild, Balken, Knopf, Schieberegler, Umschalter, Hinweis („[E] Sprechen“), Fadenkreuz.
- Fertige Menü-Prefabs: Hauptmenü, Pausemenü, Einstellungen (Grafikstufe, Lautstärke, Maus-Empfindlichkeit, Tastenbelegung, Vollbild), Sieg und Niederlage, Ladebildschirm mit Fortschritt.
- Bei geteiltem Bildschirm eigenes HUD pro Spieler.

### 8.13 Gegenstände und Inventar

- Komponenten „Aufhebbar“, „Benutzbar“, „Tür“, „Schalter“, „Truhe“.
- Inventar pro Spieler mit Blöcken („füge [Schlüssel] zum Inventar hinzu“, „habe ich [Schlüssel]?“) und optionaler Anzeige.

### 8.14 Speichern

Spielstände mit mehreren Slots: alle als „wird gespeichert“ markierten Variablen, Position und Zustand der Spieler, Inventar, aktuelle Szene. Im Browser lokal, im Desktop-Export als Datei.

### 8.15 Komponenten (Mindestumfang)

Über „Komponente hinzufügen“ erreichbar, jede mit Inspektor-Feldern, eigenen Blöcken und Ereignissen:

- **Darstellung:** Modell-Renderer, Licht, Kamera, Post-Processing, Partikelsystem, Gelände, Wasser, Himmel
- **Physik:** Rigidbody, Box-/Kugel-/Kapsel-/Zylinder-/Mesh-Collider, Trigger-Zone
- **Spieler:** Charakter-Controller, Third-Person-Steuerung, First-Person-Steuerung, Draufsicht-Steuerung, Fahrzeug, Inventar
- **NPC:** Nav-Agent, Wandern, Patrouille, Folgen, Fliehen, Wachen, Angreifen, Ansprechbar
- **Spielmechanik:** Lebenspunkte, Geschoss, Nahkampf-Treffer, Aufhebbar, Tür, Schalter, Truhe, Zerstörbar, Checkpoint, Bewegliche Plattform, Drehen, Schweben
- **Audio:** Audio-Quelle, Audio-Listener
- **Animation:** Animator (vereinfacht)
- **Logik:** Block-Skript (beliebig viele)

### 8.16 Partikel und Effekte

Partikelsystem-Komponente mit Inspektor-Modulen wie in Unity (Emission, Form, Lebensdauer, Farbe über Zeit, Grösse über Zeit, Schwerkraft). Vorlagen: Staub beim Landen, Funken, Explosion, Rauch, Feuer, Magie, Regen, Schnee, Einsammel-Glitzer.

---

## 9. Projekt, Debugging, Export, KI

### 9.1 Projektformat

```
mein-spiel/
  blockwerk.json                  Name, Formatversion, Projekteinstellungen
  Assets/
    Szenen/dorf.scene.json        Objekte (id, Bereich, Eltern, Komponenten, Werte), Licht, Himmel
    Szenen/dorf.terrain.bin       Höhen- und Texturkarte (binär, eigene Datei)
    Prefabs/zombie.prefab.json    Objekte, Komponenten, Varianten-Basis, Überschreibungen
    Block-Skripte/patrouille.blocks.json   Blöcke (Blockly-Serialisierung, stabile IDs), Inspektor-Variablen
    Modelle/  Materialien/  Texturen/  Klänge/  UI/  Dialoge/
    *.meta.json                   pro Asset: stabile ID, Import-Einstellungen, Lizenz
  Einstellungen/                  Eingabe-Aktionen, Tags und Ebenen, Physik-Matrix, Grafikstufen, Build-Szenenliste
  .blockwerk/                     Verlauf, Cache, Vorschaubilder (in .gitignore)
```

- Wie in Unity bekommt jedes Asset eine Meta-Datei mit stabiler ID. Verweise laufen nur über diese IDs, Verschieben und Umbenennen bricht nichts.
- Verweise auf die Asset-Bibliothek ebenfalls per stabiler ID. Der Export nimmt nur benutzte Assets mit.
- Validierung mit zod-Schemas, Formatversion, Migrationen mit Sicherungskopie.
- Deterministische Ausgabe: sortierte Schlüssel, LF, 2 Leerzeichen. Unverändertes Projekt speichern = null Änderungen in Git.
- Teilen als einzelne `.blockwerk`-Datei (ZIP), Prefabs einzeln als Paket exportierbar.

### 9.2 Debugging

- Konsole wie in Unity (Löschen, Zusammenfassen, Bei Fehler pausieren, Filter Info/Warnung/Fehler). **Klick auf einen Eintrag springt zum Block oder Objekt.**
- Laufende Skripte leuchten. Pause, Einzelbild, Zeitlupe.
- Haltepunkte auf Blöcken, bedingte Haltepunkte, Einzelschritt.
- Inspektor im Play-Modus zeigt Variablen der Block-Skripte, NPC-Zustand und laufende Skripte, Werte live änderbar.
- Block `schreibe ins Log ( )`.
- Diagnose vor jedem Start: fehlende Verweise in Inspektor-Feldern, leere Steckplätze, Nachrichten ohne Empfänger, NPCs ohne Navigationsnetz, Spieler ohne Kamera, fehlende Animationen, Modelle ohne Collider.
- Profiler: Bildzeit, Skripte, Physik, Rendern, Draw Calls, Dreiecke, Objekte pro Prefab.
- Fehlermeldungen auf Deutsch, Beispiel: „Der NPC *Wache 2* findet keinen Weg zu *Held*: Er steht ausserhalb des Navigationsnetzes. [Zum Objekt] [Netz anzeigen]“

### 9.3 Export (Build-Einstellungen)

- Szenenliste mit Startszene, Plattform wählen, „Build“ und „Build und starten“ wie in Unity.
- **Windows-App (.exe)** mit Vollbild, Grafikstufen, Einstellungsmenü, eigenem Symbol und Startbild.
- **Web** (Ordner und ZIP, z. B. für itch.io).
- Ladebildschirm, nur benutzte Assets, `CREDITS.txt` mit allen Fremd-Assets und Lizenzen.
- Keine Konto-Pflicht, keine Export-Limits, alles offline.

### 9.4 KI-Assistent (optional)

- Nur aktiv mit eigenem API-Schlüssel (lokal, in Electron per `safeStorage` verschlüsselt). Modell wählbar, Standard ist ein aktuelles Claude-Modell über die Anthropic API.
- Funktionen:
  - **Logik bauen:** „Wache soll das Tor bewachen und den Spieler verfolgen, wenn sie ihn sieht“ → Block-Skript als Vorschlag.
  - **Welt bauen:** „Stell ein kleines Dorf mit 5 Häusern, Brunnen und Bäumen auf die Wiese“ → Objekte aus der Bibliothek, halbtransparent in der Szene als Vorschlag.
  - **Erklären**, **„Warum funktioniert das nicht?“** (mit Konsole, Diagnose, Variablenwerten), **Aufräumen**.
- Die KI erhält Blockkatalog, Komponentenliste, Bibliotheks-Index und eine kompakte Projektzusammenfassung, antwortet mit strukturiertem JSON, das gegen Schema, Katalog und Index geprüft wird (höchstens zwei Reparaturversuche).
- Nie eine Änderung ohne Vorschau und Bestätigung. Jede KI-Änderung ist ein Rückgängig-Schritt. Ohne Schlüssel ist nichts davon sichtbar.

### 9.5 Open Source auf GitHub

**Repository**
- Öffentliches GitHub-Repository, Code unter **MIT-Lizenz**. Alle Abhängigkeiten mit verträglicher Lizenz (`THIRD_PARTY.md`), Startpaket der Bibliothek nur CC0 (`library/LICENSES.md`).
- Das Startpaket liegt nicht im Git, sondern wird per `pnpm assets:fetch` geladen und zusätzlich als ZIP an jedes Release gehängt (CC0 erlaubt die Weitergabe). So bleibt das Repository klein.
- Dateien im Wurzelverzeichnis: `README.md`, `LICENSE`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md` (Contributor Covenant), `SECURITY.md`, `CHANGELOG.md`, `THIRD_PARTY.md`.
- `README.md`: Was Blockwerk ist, GIF und Screenshots, Download-Link zum neuesten Release, Schnellstart für Entwickler, Roadmap (Phasenplan mit Status), Vergleich „Unity-Begriff → Blockwerk“.
- `CONTRIBUTING.md`: Entwicklungsumgebung, Befehle, Commit-Regeln, und Schritt-für-Schritt-Anleitungen für die häufigsten Beiträge: **einen neuen Block hinzufügen** (eine Datei in `packages/blocks`), **eine Komponente hinzufügen**, **ein Asset-Paket aufnehmen** (nur CC0, über eine Quellbeschreibung), **eine Übersetzung ergänzen**.

**GitHub-Funktionen**
- `.github/ISSUE_TEMPLATE/`: Fehler melden, Idee vorschlagen, neuer Block, neues Asset-Paket. `PULL_REQUEST_TEMPLATE.md` mit Checkliste (Tests, Golden-Test für neue Blöcke, Screenshot bei Oberflächen-Änderungen, beide Sprachen).
- Labels: `good first issue`, `block`, `komponente`, `editor`, `runtime`, `assets`, `doku`. Fehlende Blöcke aus Anhang A werden als `good first issue` angelegt.
- GitHub Discussions für Fragen und zum Zeigen eigener Spiele.
- Schutz von `main`: Änderungen über Pull Requests, CI muss grün sein.

**GitHub Actions**
- `ci.yml`: bei jedem Push und Pull Request Lint, Typprüfung, Unit- und Golden-Tests, Build, Playwright-Tests mit Screenshots als Artefakt, auf Windows und Linux.
- `release.yml`: bei einem Tag `v*` Windows-Installer und portable `.exe` von Blockwerk bauen, Web-Version bauen, Changelog aus den Commits erzeugen, alles als GitHub Release veröffentlichen, Startpaket-ZIP anhängen.
- `pages.yml`: Dokumentation (aus den Block- und Komponenten-Definitionen erzeugt), Web-Version des Editors zum Ausprobieren und spielbare Beispielspiele auf GitHub Pages.

**Arbeitsweise im Repository**
- Jede Phase in einem eigenen Branch (`phase/03-spieler`), Abschluss per Pull Request mit der Abnahme-Checkliste der Phase im Beschreibungstext und dem Screenshot.
- Keine Geheimnisse im Repository: API-Schlüssel nur lokal, `.env` in `.gitignore`, Secret Scanning aktiviert.

---

## 10. Phasenplan mit Abnahmekriterien

Jede Phase endet mit einem Beispielprojekt in `examples/`, das im Play-Modus läuft, und einem Screenshot in `docs/screenshots/`. Erst wenn alle Kriterien erfüllt sind, beginnt die nächste Phase. Die Phasen 7 bis 10 dürfen getauscht werden.

### Phase 0: Fundament und Unity-Layout

- pnpm-Monorepo nach `CLAUDE.md`, TypeScript strict, ESLint, Prettier, Vitest, Playwright, `THIRD_PARTY.md`.
- Editor mit andockbaren Fenstern im Standard-Layout aus 5.2: Menüleiste, Werkzeugleiste, Bereichs-Reiter, Hierarchie, Szene, Spiel, Block-Editor, Inspektor, Projekt, Konsole. Layouts speichern und laden.
- Szenen-Ansicht mit Boden, Himmel, Sonne, Schatten und Unity-Kamerasteuerung (5.4), Achsenwürfel.
- Blockly im Block-Editor, `defineBlock` mit einem Testblock. Sprachumschaltung.
- Electron-Hülle.
- GitHub-Grundlage aus 9.5: Git-Repository, `LICENSE` (MIT), `README.md`-Gerüst, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, Issue- und PR-Vorlagen, `ci.yml`. Das öffentliche Repository auf GitHub legt der Nutzer an oder Claude Code mit `gh repo create`, falls `gh` angemeldet ist.

**Abnahme:**
- [ ] `pnpm dev` und `pnpm dev:desktop` öffnen den Editor. `pnpm test`, `pnpm lint`, `pnpm build` grün.
- [ ] Repository ist auf GitHub, die CI läuft dort auf Windows und Linux grün.
- [ ] Fenster lassen sich verschieben, als Reiter gruppieren und abtrennen; Layout bleibt nach Neustart erhalten.
- [ ] Szenen-Kamera bedient sich wie in Unity (Fliegen, Umkreisen, Verschieben, Fokussieren).
- [ ] Die leere Szene sieht ordentlich aus: Himmel, Licht, weicher Schatten eines Testwürfels.

### Phase 1: Objekte, Komponenten, Block-Skripte, Play-Modus

- Hierarchie (Eltern-Kind, Drag-and-Drop, Umbenennen, Duplizieren), Bereichs-Reiter als Wurzel-Objekte mit Filter.
- Gizmos Verschieben/Drehen/Skalieren/Kombi mit Einrasten, Mehrfachauswahl, Grundformen im Menü „Objekt“.
- Inspektor mit Kopfzeile, Transform, Modell-Renderer, Material, Collider, „Komponente hinzufügen“, Kontextmenü, Mehrfachbearbeitung.
- Block-Skript als Asset und Komponente, Inspektor-Variablen, Doppelklick öffnet den Block-Editor.
- Blöcke (Anhang A, Phase 1), Compiler (inklusive Funktionen und lokalen Variablen in der Zwischenrepräsentation), Scheduler mit 60 Hz.
- Play-Modus (5.5) mit Zurücksetzen, „Diesen Wert behalten“, Pause, Einzelbild, Zeitlupe, Hot Reload, Tönung.
- Konsole mit Sprung zum Block. Projektformat (9.1) mit Meta-Dateien, Speichern, Laden, Autosave.

**Abnahme:**
- [ ] `examples/01-hindernis`: Parcours aus Grundformen. Ein Würfel mit Block-Skript wird mit WASD gesteuert, sammelt drei Kugeln (Tag `Einsammelbar`), Punkte erscheinen. Die Geschwindigkeit ist ein Inspektor-Feld.
- [ ] Dasselbe Block-Skript an einem zweiten Würfel mit anderer Geschwindigkeit funktioniert unabhängig.
- [ ] Play-Modus startet in unter 1 Sekunde, Stoppen setzt zurück, ein behaltener Wert bleibt.
- [ ] Speichern, schliessen, laden: identisch, null Git-Diffs beim erneuten Speichern. Asset umbenennen bricht keinen Verweis.

### Phase 2: Projekt-Fenster, Asset-Bibliothek, Prefabs

- Projekt-Fenster (5.8), Import eigener Modelle mit Import-Inspektor (6.3).
- `pnpm assets:fetch` und Asset-Bibliothek (6.1, 6.2), Hineinziehen mit Aufsetzen, Pinsel, automatische Instanziierung.
- Prefabs, Prefab-Modus, Überschreibungen, Varianten, verschachtelte Prefabs, „Meine Prefabs“ (6.4).

**Abnahme:**
- [ ] Startpaket mit mindestens 300 Modellen, alle CC0, mit Vorschaubild und Lizenzeintrag.
- [ ] `examples/02-dorf`: Dorf mit Häusern, Brunnen, Zäunen und 200 Bäumen in unter 15 Minuten nur aus der Bibliothek gebaut, 60 FPS im Play-Modus.
- [ ] Prefab „Laterne“ geändert: alle Exemplare übernehmen es, ein überschriebener Wert bleibt; Variante „Rote Laterne“ erbt Änderungen der Basis.

### Phase 3: Spieler, Physik, Animation

- Rigidbody, Collider, Trigger, Physik-Ebenen (8.4). Charakter-Controller und Steuerungs-Komponenten (8.5), Kamera (8.6), Animator (8.7).
- Eingabe-Aktionen pro Spieler, Gamepad, Spieler 2 mit geteiltem Bildschirm.
- Testgelände (5.6).

**Abnahme:**
- [ ] `examples/03-held`: Animierte Figur aus der Bibliothek, nur mit Komponenten (ohne eigene Blöcke): läuft, rennt, springt, landet mit weichen Übergängen, Kamera weicht Wänden aus. Punkte 1, 2, 3 und 5 der Unity-Gefühl-Checkliste erfüllt.
- [ ] Im Testgelände funktionieren Treppen, Rampen bis zum eingestellten Winkel, Sprunglücken, bewegliche Plattform und Kisten schieben.
- [ ] Spieler 2 per Gamepad im geteilten Bildschirm, beide mit eigener Kamera.

### Phase 3b: Figuren-Studio

- Alles aus 5.10: Modell wählen und hochladen (GLB, FBX, OBJ, VRM), Skelett-Zuordnung, Animations-Übertragung, Baukasten, Farben, Halte-Punkte, Animationsliste mit Zeitleiste, Bewegungs-Regler mit Sprungbogen, Bewegungs-Profile, Fähigkeiten-Karten, Kollisions-Kapsel, Klang-Sets, Kamera-Vorschau, Porträt.

**Abnahme:**
- [ ] Ein VRM-Avatar und ein geriggtes FBX-Modell werden hochgeladen und laufen, rennen und springen danach mit den Bibliotheks-Animationen. Einzige Handarbeit: Skelett-Zuordnung bestätigen. Für die automatischen Tests wird ein CC0-Modell verwendet.
- [ ] Ein Modell ohne Skelett wird als starre Figur verwendet und wirkt durch Wippen und Neigen trotzdem lebendig.
- [ ] Mit dem Baukasten eine eigene Figur gestalten (Haare, Kleidung, Farben), Schwert in die rechte Hand ziehen: Es folgt allen Animationen.
- [ ] Bewegungs-Profil von „Arcade“ auf „Schwer“ wechseln: im Testgelände sofort spürbar. Der angezeigte Sprungbogen stimmt mit dem echten Sprung auf ±10 % überein.
- [ ] Fähigkeiten-Karten „Doppelsprung“ und „Rollen“ auf die Figur ziehen: funktionieren im Testgelände ohne einen einzigen eigenen Block.
- [ ] Porträt erstellen und als Bild im Projekt finden. Spieler 2 per „Wie Spieler 1, aber andere Farben“ erstellen.

### Phase 4: Umgebung und Grafik

- Gelände, Gras, Wasser, Himmel, Tag-Nacht, Wetter, Nebel, Beleuchtungs-Fenster.
- Post-Processing, Grafikstufen (8.3), Audio-Quelle mit 3D-Klang, Partikelsystem.

**Abnahme:**
- [ ] `examples/04-landschaft`: Hügellandschaft mit See, Wald, Dorf, Tag-Nacht-Wechsel und Regen, 60 FPS auf „Hoch“ (Abschnitt 12).
- [ ] Punkte 4, 6 und 7 der Unity-Gefühl-Checkliste erfüllt.
- [ ] Grafikstufe im Play-Modus wechseln ohne Neustart.

### Phase 5: NPCs und Spiellogik

- Navigation, Nav-Agent, NPC-Komponenten, Zustände als Blöcke, Dialog-Editor (8.8).
- Gegenstände, Inventar, Lebenspunkte, Kampf (8.13, 8.15), Nachrichten, mehrere Szenen mit Ladebildschirm.

**Abnahme:**
- [ ] `examples/05-quest`: NPC gibt per Dialog einen Auftrag, Spieler findet einen Schlüssel in einer Truhe, öffnet ein Tor, bringt einen Gegenstand zurück, bekommt eine Belohnung.
- [ ] Zwei Zombies (Prefab-Variante von `Gegner`) patrouillieren, entdecken den Spieler per Sichtkegel und verfolgen ihn um Hindernisse herum; Zustand im Play-Modus sichtbar.
- [ ] Szenenwechsel Dorf → Höhle mit Ladebildschirm, Spielerzustand bleibt erhalten.

### Phase 6: UI, Menüs, Speichern

- UI-Leinwand und UI-Editor, Menü-Prefabs (8.12), Spielstände (8.14).

**Abnahme:**
- [ ] `examples/05-quest` hat Hauptmenü, Pausemenü, Einstellungen (Grafikstufe, Lautstärke, Maus-Empfindlichkeit, Tastenbelegung), Lebensbalken, Inventar-Anzeige, Interaktions-Hinweise.
- [ ] Speichern und Laden über drei Slots stellt Position, Inventar und Quest-Fortschritt wieder her.
- [ ] Punkte 8 und 9 der Unity-Gefühl-Checkliste erfüllt.

### Phase 7: Grosse Projekte

- Eigene Blöcke mit Rückgabewert und Bedingung, lokale Variablen (Oberfläche), „ohne Bildschirmaktualisierung“, Typprüfung, Wörterbücher.
- Tastatur-Eingabe, Navigation, Überall umbenennen, Auslagern (7.8), Code-Ansicht und Code-Block (7.9).

**Abnahme:**
- [ ] `examples/07-gross`: mindestens 80 Block-Skripte über alle Bereiche, lädt in unter 3 Sekunden.
- [ ] Variable umbenennen ändert alle Verwendungen in allen Block-Skripten.
- [ ] `wenn taste` tippen + Enter fügt den Ereignis-Block ein; `x/2 + 10` in ein Zahlenfeld tippen erzeugt Operator-Blöcke.
- [ ] Prefab mit Block-Skript und eigenem Block in ein neues Projekt übernommen: keine fehlenden Blöcke.

### Phase 8: Debugging

- Alles aus 9.2.

**Abnahme:**
- [ ] `examples/08-kaputt` mit absichtlichen Fehlern (leeres Inspektor-Feld, Nachricht ohne Empfänger, NPC ausserhalb des Navigationsnetzes, Endlosschleife ohne Frame-Abgabe, Figur ohne Laufanimation). Jeder Fehler erscheint verständlich auf Deutsch in der Konsole, Klick springt zur richtigen Stelle. Der Editor friert nie ein.
- [ ] Haltepunkt, Einzelschritt, Wert im Inspektor ändern, weiterlaufen.

### Phase 9: Build und Export

- Alles aus 9.3.

**Abnahme:**
- [ ] `examples/05-quest` als Windows-.exe gebaut: startet im Vollbild ohne Editor, offline, mit Ladebildschirm und funktionierenden Einstellungen.
- [ ] Web-Build läuft im Browser. `CREDITS.txt` listet alle Fremd-Assets.
- [ ] `release.yml` aus 9.5: Ein Tag `v0.9.0` erzeugt auf GitHub automatisch ein Release mit Windows-Installer von Blockwerk, Web-Version, Changelog und Startpaket-ZIP.

### Phase 10: KI-Assistent

- Alles aus 9.4.

**Abnahme:**
- [ ] „Wache soll das Tor bewachen und den Spieler verfolgen, wenn sie ihn sieht“ erzeugt ein gültiges Block-Skript, das nach dem Übernehmen funktioniert.
- [ ] „Stell 5 Häuser und einen Brunnen auf die Wiese“ platziert passende Bibliotheks-Objekte als Vorschlag.
- [ ] Ungültige Antworten werden abgefangen. Ohne API-Schlüssel ist nichts sichtbar und nichts geht ins Netz.

### Phase 11: Feinschliff und Endabnahme

- Vorlagen-Projekte: Third-Person-Abenteuer, Ego-Arena, 3D-Plattformer, Koop-Sammelspiel, kleines Rennspiel.
- Interaktives Einsteiger-Tutorial („Deine erste Welt in 10 Minuten“).
- Automatisch erzeugte Dokumentation aller Blöcke und Komponenten, mit Hinweis auf das Unity-Gegenstück.
- Barrierefreiheit prüfen.
- GitHub fertigstellen: `README.md` mit GIF und Screenshots, `pages.yml` mit Doku, Web-Editor und spielbaren Beispielen, mindestens 10 `good first issue`-Einträge, Release `v1.0.0`.

**Endabnahme: das eigene Spiel**
- [ ] `examples/endspiel`: komplettes kleines 3D-Spiel, nur mit Blockwerk gebaut: Hauptmenü → Ladebildschirm → offene Landschaft mit Dorf und Tag-Nacht-Wechsel → animierter Third-Person-Held, im Figuren-Studio gestaltet, mit mindestens zwei Fähigkeiten-Karten → mindestens drei NPCs (Auftraggeber, Händler, Wache) mit Dialogen → Gegner mit Navigation und Kampf → Gegenstände und Inventar → Spieler 2 im geteilten Bildschirm → Speichern und Laden → Sieg und Niederlage → Windows-.exe.
- [ ] Alle 10 Punkte der Unity-Gefühl-Checkliste (1.1) erfüllt und im Bericht einzeln belegt.
- [ ] Jemand mit Unity-Erfahrung findet sich im Editor ohne Erklärung zurecht: Szene, Hierarchie, Inspektor, Prefabs, Play-Modus funktionieren wie erwartet.
- [ ] 60 FPS auf „Hoch“ auf der Zielhardware (Abschnitt 12).

---

## 11. Später (nicht im ersten Umfang)

- Online-Mehrspieler
- 2D-Modus mit denselben Blöcken
- Android, iOS, VR
- Animator mit vollem Zustandsdiagramm und Zeitleisten-Fenster
- Import von Scratch-Projekten (`.sb3`)
- Code-Ansicht zum Bearbeiten (Code ↔ Blöcke)
- Erweiterungs-Galerie, Gemeinschafts-Galerie für Prefabs und Spiele
- Zusammenarbeit in Echtzeit

---

## 12. Qualitätsziele

**Zielhardware:** „Hoch“ auf einem Mittelklasse-Laptop mit Einsteiger-Grafikkarte bei 1080p; „Mittel“ auf einem Laptop mit integrierter Grafik bei 1080p.

| Ziel | Wert |
|---|---|
| Bildrate in `examples/04-landschaft` (jeweilige Zielhardware) | ≥ 60 FPS |
| Draw Calls in der Landschaftsszene auf „Hoch“ | < 500 |
| Klick auf Play bis Spiel läuft | < 1 s |
| Projekt mit 80 Block-Skripten und Landschaftsszene öffnen | < 3 s |
| Unverändertes Projekt speichern | 0 Git-Änderungen |
| Fehlermeldungen | 100 % Deutsch und Englisch, mit Sprung zum Block oder Objekt |
| Editor-Absturz durch Fehler im Spiel | nie |

---

## Anhang A: Blockkatalog (Start)

Texte sind Vorschläge. In Klammern: Phase. Positionen in Metern, Winkel in Grad, Zeit in Sekunden.

**Ereignisse**
- Wenn Spiel startet (1), Wenn Szene startet (5), Jeden Frame (1)
- Wenn Taste [W] [gedrückt | gehalten | losgelassen] (1)
- Wenn Aktion [Springen] [ausgelöst | gehalten | beendet] für [Spieler 1 | Spieler 2 | jeden Spieler] (3)
- Wenn dieses Objekt angeklickt wird (1)
- Wenn ich [Objekt | Tag] [beginne zu berühren | berühre | aufhöre zu berühren] (1)
- Wenn [Objekt | Tag] Zone betritt / verlässt (3)
- Wenn ich erstellt werde / zerstört werde (1)
- Wenn ich Nachricht [ ] empfange (5), Wenn Timer [ ] abläuft (5)

**Bewegung und Drehung** (1)
- gehe ( ) Meter [vorwärts | rückwärts | links | rechts | hoch | runter]
- gehe zu x: ( ) y: ( ) z: ( ), gehe zu [Objekt]
- bewege dich in ( ) s zu [Objekt | Punkt] mit [linear | weich | federnd]
- drehe dich um ( ) Grad [links | rechts | hoch | runter], schaue zu [Objekt | Maus]
- setze Position / Drehung / Grösse
- Werte: x, y, z, Blickrichtung, Abstand zu [ ], Position von [ ]

**Spieler** (3)
- setze Laufgeschwindigkeit / Rennen / Sprunghöhe auf ( )
- springe, ducke dich, stehe auf, sperre Steuerung / gib Steuerung frei
- <stehe ich auf dem Boden?>, <renne ich?>, (Geschwindigkeit)
- teleportiere [Spieler] zu [Checkpoint]

**Kamera** (3)
- wechsle Kamera zu [Third-Person | First-Person | Draufsicht | Kamera-Objekt]
- setze Kamera-Abstand auf ( ), Kamera wackeln Stärke ( ) Dauer ( ), Kamerafahrt [ ] abspielen, setze Sichtfeld auf ( ) in ( ) s

**Aussehen und Animation**
- setze Farbe / Material auf [ ], zeige dich, verstecke dich, setze Grösse auf ( ) % (1)
- aktiviere / deaktiviere [Objekt | Komponente] (1)
- spiele Animation [ ] [einmal | in Schleife] mit Überblendung ( ) s (3)
- Wenn Animation [ ] Ereignis [ ] erreicht (3)

**Figur** (3b)
- hänge [Gegenstand] an [rechte Hand | linke Hand | Rücken | Kopf | Hüfte], lege [Halte-Punkt] ab
- wechsle Teil [Hut | Oberteil | …] zu [ ], setze Farbe von [Haare | Haut | Oberteil | …] auf [ ]
- wechsle Bewegungs-Profil zu [Arcade | Realistisch | Flink | Schwer | Schwebend]
- aktiviere / deaktiviere Fähigkeit [Doppelsprung | Rollen | …], <habe ich Fähigkeit [ ]?>
- setze Ausdauer auf ( ), (Ausdauer), Wenn ich [rolle | gleite | klettere | schwimme]

**Physik** (3)
- stosse mich an mit Kraft ( ) Richtung [ ], setze Geschwindigkeit, setze Schwerkraft auf ( )
- (was ist vor mir in ( ) Meter?) → Objekt oder nichts
- mache [statisch | dynamisch | kinematisch]

**NPC und KI** (5)
- gehe zu [Objekt | Punkt] (Wegfindung), folge [ ] mit Abstand ( ), fliehe vor [ ], wandere herum in Radius ( )
- patrouilliere entlang [Wegpunkte], bleib stehen
- Wenn Zustand [ ] / wechsle Zustand zu [ ] / (aktueller Zustand)
- <sehe ich [ ]?>, <höre ich [ ]?>, (nächstes Objekt mit Tag [ ])
- starte Dialog [ ], Wenn Dialog-Antwort [ ]

**Umgebung** (4)
- setze Tageszeit auf ( ) Uhr, lasse Zeit laufen mit Faktor ( )
- setze Wetter auf [klar | Regen | Schnee | Nebel] in ( ) s
- setze Nebeldichte, Sonnenhelligkeit, Himmel auf [ ]
- schalte Licht [ ] [ein | aus], setze Lichtfarbe

**Gegenstände und Inventar** (5)
- füge [ ] zum Inventar von [Spieler] hinzu, entferne [ ], <habe ich [ ]?>, (Anzahl [ ])
- öffne / schliesse [Tür | Truhe], hebe [ ] auf, lege [ ] ab
- füge ( ) Schaden zu [ ] hinzu, heile ( ), (Lebenspunkte von [ ])

**Klang** (4)
- spiele Klang [ ] [hier | überall], spiele Musik [ ] in Schleife, blende Musik über zu [ ] in ( ) s
- stoppe alle Klänge, setze Lautstärke [Musik | Effekte | Stimmen] auf ( ) %

**Effekte** (4)
- erzeuge Effekt [Staub | Funken | Explosion | …] bei [ ], starte / stoppe Partikelsystem [ ]

**Steuerung**
- warte ( ) s, warte bis < > (1)
- wiederhole ( ) mal, wiederhole für immer, wiederhole bis < > (1)
- falls < > dann, falls … sonst (1)
- für jedes [Element] in [Liste] (5), für jedes Objekt mit Tag [ ] (5)
- erzeuge [Prefab | Asset] bei [ ] → gibt Objekt zurück (1), zerstöre [mich | Objekt] (1)
- stoppe [dieses Skript | alle] (1), starte Timer [ ] mit ( ) s (5)

**Fühlen** (1)
- <Taste [ ] gedrückt?>, <Aktion [ ] aktiv?> (Aktion 3)
- (Abstand zu [ ]), <berühre ich [ ]?>, (Maus x / y), <Maustaste gedrückt?>
- (Stoppuhr), setze Stoppuhr zurück, (Zufallszahl von ( ) bis ( ))

**Operatoren** (1)
- ( ) + ( ), −, ×, ÷, Rest, runde, Betrag, Wurzel, sin, cos, min, max, begrenze, interpoliere
- <, =, >, und, oder, nicht
- verbinde, Länge, Zeichen ( ) von ( ), enthält?

**Variablen und Listen**
- setze [ ] auf ( ), ändere [ ] um ( ), zeige / verstecke Anzeige [ ] (1)
- lokale Variable [ ] = ( ) (7)
- Listen: füge hinzu, entferne, ersetze, Element, Länge, enthält?, sortiere, mische (5)
- Wörterbücher (7)

**UI** (6)
- zeige / verstecke [UI-Element], setze Text von [ ] auf ( ), setze Balken [ ] auf ( ) %
- zeige Hinweis ( ) für ( ) s, öffne Menü [ ]

**Szenen und Speichern**
- lade Szene [ ] mit Ladebildschirm, starte Szene neu, pausiere / setze fort (5)
- speichere Spiel in Slot ( ), lade Slot ( ), <gibt es Spielstand in Slot ( )?> (6)

**Meine Blöcke** (7)
- definiere [Befehl | Wert | Bedingung], gib zurück ( )

**Debug** (8)
- schreibe ins Log ( ), halte hier an

---

## Anhang B: Laufzeitmodell und Compiler-Beispiel

Block-Skript `Sprung-Staub` an Objekt Held (Bereich Spieler 1):

```
Wenn Spiel startet
  wiederhole für immer
    falls <Aktion [Springen] ausgelöst?> und <stehe ich auf dem Boden?> dann
      springe
      erzeuge Effekt [Staub] bei [mir]
```

Erzeugtes JavaScript (vereinfacht):

```ts
// asset: sprung-staub.blocks.json, script: s_7f3a
export function* s_7f3a(self: GameObject, game: Game) {
  while (true) {
    if (game.input.actionPressed('jump', self.playerIndex) && self.controller.isGrounded()) {
      self.controller.jump();
      game.fx.spawn('dust', self.position);
    }
    yield; // nächster Frame
  }
}
```

- Jedes Skript wird einer Generator-Funktion zugeordnet, der Scheduler ruft `next()` einmal pro Logik-Tick auf.
- `warte (1) Sekunden` wird zu `yield* game.wait(1)`.
- Inspektor-Variablen werden pro Objekt als `self.vars` übergeben.
- Jede erzeugte Zeile bekommt eine Quellzuordnung zur Block-ID (für Leuchten, Haltepunkte, Konsole, Code-Ansicht).
- Der Compiler arbeitet auf der Zwischenrepräsentation, nicht auf Blockly-Objekten.

---

## Anhang C: Startpaket der Asset-Bibliothek (Ziel)

| Kategorie | Ziel | Beispiele |
|---|---|---|
| Grundformen | 10 | Würfel, Kugel, Zylinder, Kapsel, Rampe, Treppe |
| Natur | 60 | Laub- und Nadelbäume, Büsche, Steine, Felsen, Blumen, Gras |
| Gebäude und Bausätze | 60 | Häuser, Turm, Brücke, modulare Wände, Böden, Dächer, Zäune |
| Innenräume und Möbel | 40 | Tisch, Stuhl, Bett, Regal, Kiste, Fass, Lampe |
| Figuren (animiert) | 20 | Held, Ritter, Magier, Dorfbewohner, Händler, Wache, Zombie, Skelett |
| Tiere | 10 | Hund, Katze, Pferd, Vogel, Fisch |
| Fahrzeuge | 15 | Auto, Lastwagen, Boot, Karren |
| Gegenstände | 50 | Münze, Edelstein, Schlüssel, Truhe, Schwert, Bogen, Werkzeug, Trank |
| Dungeon und Sci-Fi | 35 | Gänge, Säulen, Türen, Fallen, Konsolen, Kisten |
| Materialien | 50 | Gras, Erde, Stein, Holz, Metall, Wasser |
| Himmel (HDRI) | 10 | Morgen, Mittag, Abend, Nacht, bewölkt |
| Klänge | 50 | Schritte, Sprung, Münze, Treffer, Tür, Umgebung, Musik |

Alle Einträge CC0. Quellen: Kenney, Quaternius, KayKit (freie Pakete), Poly Haven.

---

## Anhang D: Startprompt für Claude Code

Leeren Ordner anlegen, `CLAUDE.md` und `SPEC.md` hineinlegen, Claude Code in diesem Ordner starten und schreiben:

> Lies CLAUDE.md und SPEC.md vollständig. Erstelle PROGRESS.md mit dem Plan für Phase 0 und setze dann Phase 0 um. Halte danach an und berichte mir.

Nach jeder Phase:

> Weiter mit Phase X.

---

## Anhang E: Quellen der Analyse

**Unity und 3D**
- Unity-Bewertungen (Einsteigerfreundlichkeit, Leistung, Kompilierzeiten, Abstürze, Animation, Versionsverwaltung, Preise): https://www.capterra.com/p/158591/Unity/reviews/?page=2
- Unity Visual Scripting, Kritik an Bedienung, Debugging, Refactoring: https://discussions.unity.com/t/tried-vs-hated-it-am-i-missing-out-on-anything/864746
- Unity Visual Scripting, Leistung im Vergleich zu Blueprints und C#: https://discussions.unity.com/t/performance-troubles-unity-visual-scripting-compared-with-unreal-blueprints-and-direct-c/883750
- CoSpaces-Edu-Forum, Grenze von 10 Block-Skripten pro Szene: https://forum.edu.delightex.com/t/number-of-coblocks-in-one-scene/9396
- Rapier, Charakter-Controller (JavaScript): https://rapier.rs/docs/user_guides/javascript/character_controller
- recast-navigation-js (Navmesh, Wegfindung, Crowd, three.js-Anbindung): https://npmjs.com/package/recast-navigation
- Freie 3D-Modellquellen und Lizenzen: https://app.cinevva.com/guides/free-3d-model-sites
- Mixamo-Lizenz (keine Weitergabe der Rohdateien): https://community.adobe.com/questions-696/mixamo-faq-licensing-royalties-ownership-eula-and-tos-589400

**Scratch und Blocksprachen**
- Scratch-Forum, Klon-Limit: https://scratch.mit.edu/discuss/post/2465753 , https://scratch.mit.edu/discuss/post/8188711
- Scratch-Forum, fehlende Rückgabewerte und Debugging-Werkzeuge: https://scratch.mit.edu/discuss/topic/285382/?page=1
- Scratch-Grenzen (30 FPS, Projektgrösse, Klone): https://buildstatus.puri.sm/make-game-scratch
- Universität Rom, Scratch-Analyse: https://twiki.di.uniroma1.it/pub/CSeduA/AA2223/Lessons/Scratch.pdf
- Bau et al., „Learnable Programming: Blocks and Beyond“: https://arxiv.org/pdf/1705.09413
- Mönig, Ohshima, Maloney, „Blocks at Your Fingertips“ (MIT): https://dspace.mit.edu/handle/1721.1/98451
- Studie zu grossen Block-Programmen (NSF): https://par.nsf.gov/servlets/purl/10566302
- „Ten Things We've Learned from Blockly“: https://developers.google.cn/static/blockly/publications/papers/TenThingsWeveLearnedFromBlockly.pdf
- Blockly bei der Raspberry Pi Foundation, Lizenz: https://blockly.com , https://opensource.googleblog.com/2025/10/blockly-graduates-from-google.html

**Andere Engines**
- GDevelop-Bewertungen: https://www.capterra.com/p/158592/GDevelop/reviews/ , https://www.capterra.in/software/158592/gdevelop , https://www.getapp.ca/reviews/2072034/gdevelop , https://www.capterra.ca/software/158592/gdevelop
- GDevelop-Funktionen und Releases: https://gdevelop.io/features , https://github.com/4ian/GDevelop/releases/tag/v5.4.203
- GDevelop AI Agent: https://gamineai.com/blog/how-to-use-gdevelop-ai-agent-first-feature-one-evening-2026
- Construct-3-Bewertungen: https://www.capterra.ie/reviews/201543/construct-3 , https://www.capterra.com/p/201543/Construct-3/reviews/?page=2 , https://www.getapp.ca/software/2082637/construct-3
- MakeCode-Arcade-Forum: https://forum.makecode.com/t/is-there-some-way-to-change-your-field-of-wiew/17981/4
- ct.js und Catnip: https://github.com/ct-js/ct-js/releases , https://gamefromscratch.com/ct-js-game-engine-gets-new-catnip-visual-scripting-language/
- PenguinMod und TurboWarp: https://wiki.penguinmod.com/wiki/PenguinMod?oldid=3034 , https://wiki.penguinmod.com/wiki/Extensions , https://github.com/TurboWarp/extensions/issues/222
- Stencyl: https://www.capterra.com/p/158598/Stencyl/reviews/ , https://publish.obsidian.md/xybre/permalink/e84e22c7-b265-4d54-97ad-3b6955adb313
- Unreal Blueprints und Versionsverwaltung: https://forums.unrealengine.com/t/textual-file-formats/862?page=2 , https://usourcecontrol.com/guides/blueprint-merge-conflicts

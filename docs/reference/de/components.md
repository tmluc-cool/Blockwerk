# Komponenten

Erzeugt aus dem Blockkatalog und den Komponentendefinitionen. Nicht von Hand ändern.

### Modell-Renderer

`meshRenderer`

Zeigt eine Form mit einem Material an.

**In Unity:** `MeshRenderer + MeshFilter`

**Felder:**

- Modell (`model`): asset (model), Standard: keine
- Form (`shape`): Optionen: Würfel, Kugel, Zylinder, Kapsel, Ebene, Rampe, Treppe, Standard: "cube"
- Wirft Schatten (`castShadows`): boolean, Standard: true
- Empfängt Schatten (`receiveShadows`): boolean, Standard: true
- Farbe (`color`): color, Standard: "#d9d9d9"
- Metallisch (`metallic`): number, Standard: 0
- Glätte (`smoothness`): number, Standard: 0.45
- Textur (`texture`): Optionen: Keine, Fliesen, Standard: "none"
- Kachelung (`tiling`): number, Standard: 1

### Figur

`character`

Eine Spielfigur: Modell mit Körpergrösse, ausblendbaren und einfärbbaren Teilen, Ausrüstung an Halte-Punkten und Animationen. Humanoide Skelette werden erkannt, die Standard-Animationen der Bibliothek funktionieren auf ihnen. Modelle ohne Skelett wippen und neigen sich beim Laufen.

**In Unity:** `Animator + Avatar (Humanoid rig)`

**Felder:**

- Modell (`model`): asset (model), Standard: keine
- Körpergrösse (0 = Originalgrösse) (`bodyHeight`): number, Standard: 1.8
- Bewegungs-Profil (`profile`): Optionen: Eigene Werte, Arcade, Realistisch, Flink, Schwer, Schwebend, Standard: "custom"
- Statur (Breite) (`build`): number, Standard: 1
- Kopfgrösse (`headScale`): number, Standard: 1
- Armlänge (`armScale`): number, Standard: 1
- Beinlänge (`legScale`): number, Standard: 1
- Ausgeblendete Teile (mit ; getrennt) (`hiddenParts`): string, Standard: ""
- Eingeblendete Ausrüstungsteile (mit ; getrennt) (`shownGear`): string, Standard: ""
- Farben (Teil=#rrggbb; …) (`tints`): string, Standard: ""
- Ausrüstung (Modell@Punkt; …) (`attachments`): string, Standard: ""
- Klang-Set (Ereignis=Klang; …) (`sounds`): string, Standard: ""
- Bibliotheks-Animationen übertragen (`libraryAnimations`): boolean, Standard: true
- Animationen von (leer = Ritter) (`animationSource`): asset (model), Standard: keine
- Skelett-Zuordnung (Standard=Knochen; …) (`boneMap`): string, Standard: ""
- Wippen ohne Skelett (`rigidMotion`): boolean, Standard: true

### Animator

`animator`

Spielt die Animationen des Modells. Mit einer Steuerungs-Komponente wählt er Stehen, Gehen, Rennen, Springen, Fallen, Landen und Ducken selbst und blendet weich über.

**In Unity:** `Animator`

**Felder:**

- Von Steuerung gesteuert (`useControls`): boolean, Standard: true
- Standard-Animation (`defaultState`): Optionen: Stehen, Gehen, Rennen, Springen, Fallen, Landen, Ducken, Geduckt gehen, Angreifen, Treffer, Sterben, Winken, Jubeln, Benutzen, Rollen, Abwehren, Sitzen, Standard: "idle"
- Überblendzeit (`crossFade`): number, Standard: 0.2
- Geschwindigkeit (`speed`): number, Standard: 1
- Ereignisse (Zustand@Sekunde=Name; …) (`markers`): string, Standard: ""
- Tempo der Geh-Animation (m/s) (`walkClipSpeed`): number, Standard: 2.2
- Tempo der Renn-Animation (m/s) (`runClipSpeed`): number, Standard: 5.5

### Rigidbody

`rigidbody`

Lässt die Physik das Objekt bewegen: Schwerkraft, Stösse, Umfallen. „Kinematisch“ bewegt sich nur per Skript oder Animation, schiebt aber andere Körper.

**In Unity:** `Rigidbody`

**Felder:**

- Art (`bodyType`): Optionen: Dynamisch, Kinematisch, Standard: "dynamic"
- Masse (kg) (`mass`): number, Standard: 1
- Luftwiderstand (`drag`): number, Standard: 0
- Drehwiderstand (`angularDrag`): number, Standard: 0.05
- Schwerkraft (`useGravity`): boolean, Standard: true
- Drehung X sperren (`freezeRotationX`): boolean, Standard: false
- Drehung Y sperren (`freezeRotationY`): boolean, Standard: false
- Drehung Z sperren (`freezeRotationZ`): boolean, Standard: false
- Schnelle Objekte (CCD) (`continuous`): boolean, Standard: false

### Box-Collider

`boxCollider`

Quaderförmige Kollisionsform.

**In Unity:** `BoxCollider`

**Felder:**

- Ist Trigger (`isTrigger`): boolean, Standard: false
- Mitte (`center`): vector3, Standard: [0,0,0]
- Reibung (`friction`): number, Standard: 0.6
- Abprallen (`bounciness`): number, Standard: 0
- Grösse (`size`): vector3, Standard: [1,1,1]

### Kugel-Collider

`sphereCollider`

Kugelförmige Kollisionsform.

**In Unity:** `SphereCollider`

**Felder:**

- Ist Trigger (`isTrigger`): boolean, Standard: false
- Mitte (`center`): vector3, Standard: [0,0,0]
- Reibung (`friction`): number, Standard: 0.6
- Abprallen (`bounciness`): number, Standard: 0
- Radius (`radius`): number, Standard: 0.5

### Kapsel-Collider

`capsuleCollider`

Kapselförmige Kollisionsform, z. B. für Figuren.

**In Unity:** `CapsuleCollider`

**Felder:**

- Ist Trigger (`isTrigger`): boolean, Standard: false
- Mitte (`center`): vector3, Standard: [0,0,0]
- Reibung (`friction`): number, Standard: 0.6
- Abprallen (`bounciness`): number, Standard: 0
- Radius (`radius`): number, Standard: 0.5
- Höhe (`height`): number, Standard: 2

### Zylinder-Collider

`cylinderCollider`

Zylinderförmige Kollisionsform, z. B. für Säulen und Fässer.

**In Unity:** `none (use a CapsuleCollider or MeshCollider)`

**Felder:**

- Ist Trigger (`isTrigger`): boolean, Standard: false
- Mitte (`center`): vector3, Standard: [0,0,0]
- Reibung (`friction`): number, Standard: 0.6
- Abprallen (`bounciness`): number, Standard: 0
- Radius (`radius`): number, Standard: 0.5
- Höhe (`height`): number, Standard: 1

### Mesh-Collider

`meshCollider`

Nutzt die Form des Modells als Kollisionsform. „Konvex“ legt eine Hülle darum; nur konvexe Mesh-Collider können sich mit einem Rigidbody bewegen.

**In Unity:** `MeshCollider`

**Felder:**

- Ist Trigger (`isTrigger`): boolean, Standard: false
- Mitte (`center`): vector3, Standard: [0,0,0]
- Reibung (`friction`): number, Standard: 0.6
- Abprallen (`bounciness`): number, Standard: 0
- Konvex (`convex`): boolean, Standard: false

### Charakter-Controller

`characterController`

Kapsel für Spielerfiguren: geht Rampen bis zum Grenzwinkel hoch, steigt Treppen, haftet beim Bergab-Laufen am Boden, gleitet an Wänden entlang und schiebt lose Objekte.

**In Unity:** `CharacterController`

**Felder:**

- Höhe (`height`): number, Standard: 1.8
- Radius (`radius`): number, Standard: 0.3
- Mitte (`center`): vector3, Standard: [0,0.9,0]
- Grenzwinkel (`slopeLimit`): number, Standard: 45
- Stufenhöhe (`stepOffset`): number, Standard: 0.35
- Hautdicke (`skinWidth`): number, Standard: 0.08
- Am Boden haften (`snapDistance`): number, Standard: 0.3
- Schiebekraft (kg) (`pushMass`): number, Standard: 70

### Third-Person-Steuerung

`thirdPersonControl`

Steuert die Figur relativ zur Kamera: Bewegen, Rennen, Ducken, Springen. Braucht einen Charakter-Controller.

**In Unity:** `ThirdPersonController (Starter Assets)`

**Felder:**

- Spieler (`player`): Optionen: Spieler 1, Spieler 2, Standard: "1"
- Laufgeschwindigkeit (m/s) (`walkSpeed`): number, Standard: 2.2
- Renngeschwindigkeit (m/s) (`runSpeed`): number, Standard: 5.5
- Duckgeschwindigkeit (m/s) (`crouchSpeed`): number, Standard: 1.2
- Beschleunigung (`acceleration`): number, Standard: 10
- Drehglättung (`rotationSmoothTime`): number, Standard: 0.12
- Sprunghöhe (`jumpHeight`): number, Standard: 1.2
- Schwerkraft (m/s²) (`gravity`): number, Standard: 15
- Luftsteuerung (`airControl`): number, Standard: 0.5
- Gnadenfrist an Kanten (`coyoteTime`): number, Standard: 0.15
- Sprung-Puffer (`jumpBuffer`): number, Standard: 0.15
- Höhe geduckt (`crouchHeight`): number, Standard: 1.1

### First-Person-Steuerung

`firstPersonControl`

Ego-Sicht: Maus oder rechter Stick drehen die Figur, Bewegen ist relativ zur Blickrichtung. Braucht einen Charakter-Controller.

**In Unity:** `FirstPersonController (Starter Assets)`

**Felder:**

- Spieler (`player`): Optionen: Spieler 1, Spieler 2, Standard: "1"
- Laufgeschwindigkeit (m/s) (`walkSpeed`): number, Standard: 2.2
- Renngeschwindigkeit (m/s) (`runSpeed`): number, Standard: 5.5
- Duckgeschwindigkeit (m/s) (`crouchSpeed`): number, Standard: 1.2
- Beschleunigung (`acceleration`): number, Standard: 10
- Drehglättung (`rotationSmoothTime`): number, Standard: 0.12
- Sprunghöhe (`jumpHeight`): number, Standard: 1.2
- Schwerkraft (m/s²) (`gravity`): number, Standard: 15
- Luftsteuerung (`airControl`): number, Standard: 0.5
- Gnadenfrist an Kanten (`coyoteTime`): number, Standard: 0.15
- Sprung-Puffer (`jumpBuffer`): number, Standard: 0.15
- Höhe geduckt (`crouchHeight`): number, Standard: 1.1

### Draufsicht-Steuerung

`topDownControl`

Für Spiele von oben: Bewegen in Bildschirmrichtung, die Figur dreht sich in Laufrichtung. Braucht einen Charakter-Controller.

**In Unity:** `top-down controller (custom script)`

**Felder:**

- Spieler (`player`): Optionen: Spieler 1, Spieler 2, Standard: "1"
- Laufgeschwindigkeit (m/s) (`walkSpeed`): number, Standard: 2.2
- Renngeschwindigkeit (m/s) (`runSpeed`): number, Standard: 5.5
- Duckgeschwindigkeit (m/s) (`crouchSpeed`): number, Standard: 1.2
- Beschleunigung (`acceleration`): number, Standard: 10
- Drehglättung (`rotationSmoothTime`): number, Standard: 0.12
- Sprunghöhe (`jumpHeight`): number, Standard: 1.2
- Schwerkraft (m/s²) (`gravity`): number, Standard: 15
- Luftsteuerung (`airControl`): number, Standard: 0.5
- Gnadenfrist an Kanten (`coyoteTime`): number, Standard: 0.15
- Sprung-Puffer (`jumpBuffer`): number, Standard: 0.15
- Höhe geduckt (`crouchHeight`): number, Standard: 1.1

### Fahrzeug-Steuerung

`vehicleControl`

Fährt wie ein Spielzeugauto: vorwärts Gas, rückwärts Bremse und Rückwärtsgang, links/rechts lenken, Rennen ist Turbo. Braucht einen Charakter-Controller.

**In Unity:** `WheelCollider + vehicle script`

**Felder:**

- Spieler (`player`): Optionen: Spieler 1, Spieler 2, Standard: "1"
- Höchstgeschwindigkeit (m/s) (`maxSpeed`): number, Standard: 12
- Beschleunigung (m/s²) (`acceleration`): number, Standard: 6
- Bremsen (m/s²) (`braking`): number, Standard: 14
- Rückwärts (m/s) (`reverseSpeed`): number, Standard: 4
- Lenkung (°/s) (`turnSpeed`): number, Standard: 90
- Schwerkraft (m/s²) (`gravity`): number, Standard: 15

### Doppelsprung

`doubleJump`

Fähigkeit: Springen in der Luft. Die Sprungtaste löst den zweiten Sprung aus.

**In Unity:** `custom script (extra jump)`

**Felder:**

- Höhe des zweiten Sprungs (`height`): number, Standard: 1
- Zusätzliche Sprünge (`jumps`): number, Standard: 1

### Rollen

`roll`

Fähigkeit: Ausweichrolle in Blickrichtung mit der Aktion „Rollen“ (Taste Q, Gamepad RB). Währenddessen ist die Figur geduckt und nicht steuerbar.

**In Unity:** `custom script (dodge roll)`

**Felder:**

- Tempo (m/s) (`speed`): number, Standard: 6
- Dauer (`seconds`): number, Standard: 0.55
- Pause danach (`cooldown`): number, Standard: 0.4

### Gleiten

`glide`

Fähigkeit: Sprungtaste in der Luft gedrückt halten, solange die Figur fällt, bremst den Fall.

**In Unity:** `custom script (glide)`

**Felder:**

- Fallgeschwindigkeit (m/s) (`fallSpeed`): number, Standard: 1.5

### Ausdauer

`stamina`

Fähigkeit: Rennen verbraucht Ausdauer, die sich in Ruhe wieder auffüllt. Ohne Ausdauer geht die Figur nur.

**In Unity:** `custom script (stamina)`

**Felder:**

- Maximale Ausdauer (s Rennen) (`max`): number, Standard: 5
- Verbrauch pro Sekunde (`drain`): number, Standard: 1
- Auffüllen pro Sekunde (`regen`): number, Standard: 0.8
- Pause vor dem Auffüllen (`delay`): number, Standard: 0.8

### Kamera

`camera`

Zeigt die Szene im Spiel aus Sicht dieses Objekts.

**In Unity:** `Camera`

**Felder:**

- Sichtfeld (`fieldOfView`): number, Standard: 60
- Nahe Grenze (`near`): number, Standard: 0.1
- Ferne Grenze (`far`): number, Standard: 1000
- Spieler (`player`): Optionen: Alle (ganzer Bildschirm), Spieler 1, Spieler 2, Standard: "all"
- Geteilter Bildschirm (`split`): Optionen: Nebeneinander, Übereinander, Standard: "vertical"
- Übergangszeit (`blendTime`): number, Standard: 0.5

### Third-Person-Kamera

`thirdPersonCamera`

Kamera-Verhalten: kreist hinter der Figur (Maus oder rechter Stick), folgt mit leichter Verzögerung, zoomt mit dem Mausrad und weicht Wänden aus. Gehört an ein Objekt mit Kamera.

**In Unity:** `Cinemachine FreeLook camera`

**Felder:**

- Ziel (leer = Spieler) (`target`): object, Standard: keine
- Abstand (`distance`): number, Standard: 4
- Kleinster Abstand (`minDistance`): number, Standard: 1.5
- Grösster Abstand (`maxDistance`): number, Standard: 8
- Höhe (`height`): number, Standard: 1.5
- Schulter-Versatz (`shoulder`): number, Standard: 0.4
- Glättung (`damping`): number, Standard: 0.1
- Empfindlichkeit (`sensitivity`): number, Standard: 1
- Y umkehren (`invertY`): boolean, Standard: false
- Kleinster Neigungswinkel (`minPitch`): number, Standard: -35
- Grösster Neigungswinkel (`maxPitch`): number, Standard: 70
- Wänden ausweichen (`avoidWalls`): boolean, Standard: true
- Kamera-Radius (`cameraRadius`): number, Standard: 0.2
- Sichtfeld beim Rennen (`sprintFov`): number, Standard: 8

### First-Person-Kamera

`firstPersonCamera`

Kamera-Verhalten: Sicht aus den Augen der Figur. Hoch und runter schauen mit Maus oder rechtem Stick, links und rechts dreht die Figur (First-Person-Steuerung).

**In Unity:** `Cinemachine virtual camera (first person)`

**Felder:**

- Ziel (leer = Spieler) (`target`): object, Standard: keine
- Augenhöhe (`eyeHeight`): number, Standard: 1.6
- Empfindlichkeit (`sensitivity`): number, Standard: 1
- Y umkehren (`invertY`): boolean, Standard: false
- Kleinster Neigungswinkel (`minPitch`): number, Standard: -80
- Grösster Neigungswinkel (`maxPitch`): number, Standard: 80
- Sichtfeld beim Rennen (`sprintFov`): number, Standard: 5

### Draufsicht-Kamera

`topDownCamera`

Kamera-Verhalten: folgt dem Ziel von schräg oben, ohne sich zu drehen.

**In Unity:** `Cinemachine virtual camera (top down)`

**Felder:**

- Ziel (leer = Spieler) (`target`): object, Standard: keine
- Abstand (`distance`): number, Standard: 14
- Neigung (`angle`): number, Standard: 60
- Blickrichtung (`direction`): number, Standard: 0
- Glättung (`damping`): number, Standard: 0.15

### Seitenansicht-Kamera

`sideCamera`

Kamera-Verhalten: zeigt das Ziel von der Seite (Blick entlang +Z) wie in einem Jump-and-Run.

**In Unity:** `Cinemachine virtual camera (side view)`

**Felder:**

- Ziel (leer = Spieler) (`target`): object, Standard: keine
- Abstand (`distance`): number, Standard: 10
- Höhe (`height`): number, Standard: 1.5
- Höhe folgen (`followHeight`): boolean, Standard: true
- Glättung (`damping`): number, Standard: 0.15

### Feste Kamera

`fixedCamera`

Kamera-Verhalten: bleibt an ihrem Platz. Mit „Blickt auf“ dreht sie sich weich zum Ziel, wie eine Überwachungskamera.

**In Unity:** `Cinemachine virtual camera (fixed)`

**Felder:**

- Blickt auf (`lookAt`): object, Standard: keine
- Auf Spieler blicken (`lookAtPlayer`): boolean, Standard: false
- Glättung (`damping`): number, Standard: 0.2

### Kamerafahrt

`cameraPath`

Kamera-Verhalten: fährt weich durch Wegpunkte. Die Wegpunkte sind die Kind-Objekte des Pfad-Objekts, in der Reihenfolge der Hierarchie.

**In Unity:** `Cinemachine Dolly Track`

**Felder:**

- Pfad (`path`): object, Standard: keine
- Dauer (`duration`): number, Standard: 5
- Wiederholen (`loop`): boolean, Standard: false
- Beim Start abspielen (`playOnStart`): boolean, Standard: true
- Blickt auf (leer = Fahrtrichtung) (`lookAt`): object, Standard: keine

### Gemeinsame Kamera

`sharedCamera`

Kamera-Verhalten für Spieler 2 ohne geteilten Bildschirm: zeigt beide Spieler und geht weiter weg, wenn sie sich voneinander entfernen.

**In Unity:** `Cinemachine Target Group`

**Felder:**

- Kleinster Abstand (`distance`): number, Standard: 10
- Rand (`framing`): number, Standard: 1.4
- Neigung (`angle`): number, Standard: 45
- Blickrichtung (`direction`): number, Standard: 0
- Glättung (`damping`): number, Standard: 0.3

### Nachbearbeitung

`postProcessing`

Bildeffekte auf dieser Kamera: Tone-Mapping, Bloom, Umgebungsverdeckung, Kantenglättung, Farbkorrektur, Vignette und Tiefenunschärfe. Die Grafikstufe begrenzt, was läuft.

**In Unity:** `Volume`

**Felder:**

- Tone-Mapping (`toneMapping`): Optionen: ACES (filmisch), AgX, Neutral, Aus, Standard: "aces"
- Belichtung (`exposure`): number, Standard: 0.6
- Bloom (`bloom`): boolean, Standard: true
- Bloom-Stärke (`bloomIntensity`): number, Standard: 0.2
- Bloom-Schwelle (`bloomThreshold`): number, Standard: 1
- Umgebungsverdeckung (`ambientOcclusion`): boolean, Standard: true
- Verdeckungs-Radius (`aoRadius`): number, Standard: 2
- Verdeckungs-Stärke (`aoIntensity`): number, Standard: 2.5
- Kantenglättung (`antialiasing`): boolean, Standard: true
- Sättigung (`saturation`): number, Standard: 1.05
- Kontrast (`contrast`): number, Standard: 0.04
- Helligkeit (`brightness`): number, Standard: 0
- Vignette (`vignette`): boolean, Standard: true
- Vignetten-Stärke (`vignetteDarkness`): number, Standard: 0.35
- Tiefenunschärfe (`depthOfField`): boolean, Standard: false
- Schärfe-Abstand (`focusDistance`): number, Standard: 8
- Unschärfe-Stärke (`bokehScale`): number, Standard: 2

### Partikelsystem

`particleSystem`

Erzeugt viele kleine Teilchen für Staub, Feuer, Rauch, Funken und andere Effekte. Die Vorlage setzt alle Module auf einmal.

**In Unity:** `Particle System`

**Felder:**

- Vorlage (`preset`): Optionen: Eigene, Staub, Funken, Explosion, Rauch, Feuer, Magie, Regen, Schnee, Glitzer, Standard: "custom"
- Beim Start abspielen (`playOnAwake`): boolean, Standard: true
- Wiederholen (`loop`): boolean, Standard: true
- Dauer (`duration`): number, Standard: 5
- Simulationsraum (`space`): Optionen: Welt, Lokal, Standard: "world"
- Rate pro Sekunde (`rate`): number, Standard: 20
- Stoss beim Start (`burst`): number, Standard: 0
- Max. Partikel (`maxParticles`): number, Standard: 500
- Form (`shape`): Optionen: Punkt, Kugel, Kegel, Quader, Kreis, Standard: "cone"
- Radius (`shapeRadius`): number, Standard: 0.3
- Kegelwinkel (`coneAngle`): number, Standard: 25
- Quadergrösse (`shapeSize`): vector3, Standard: [1,1,1]
- Lebensdauer (`lifetime`): number, Standard: 1.5
- Streuung (`lifetimeVariance`): number, Standard: 0.3
- Startgeschwindigkeit (`speed`): number, Standard: 2
- Geschwindigkeits-Streuung (`speedVariance`): number, Standard: 0.3
- Startgrösse (`startSize`): number, Standard: 0.2
- Endgrösse (`endSize`): number, Standard: 0
- Grössen-Streuung (`sizeVariance`): number, Standard: 0.3
- Startfarbe (`startColor`): color, Standard: "#ffffff"
- Endfarbe (`endColor`): color, Standard: "#ffffff"
- Start-Deckkraft (`startAlpha`): number, Standard: 1
- End-Deckkraft (`endAlpha`): number, Standard: 0
- Leuchtend (`additive`): boolean, Standard: false
- Schwerkraft-Faktor (`gravity`): number, Standard: 0
- Luftwiderstand (`drag`): number, Standard: 0

### Gelände

`terrain`

Eine Landschaft aus einer Höhenkarte mit vier Farbschichten, Gras und Kollision. Der Ursprung des Objekts liegt in der Mitte. Mit den Gelände-Werkzeugen im Inspektor formst und malst du sie.

**In Unity:** `Terrain`

**Felder:**

- Gelände-Datei (`terrain`): asset (terrain), Standard: keine
- Schicht 1 (Gras) (`layer0`): color, Standard: "#5f8f3c"
- Schicht 2 (Erde) (`layer1`): color, Standard: "#8b6b47"
- Schicht 3 (Fels) (`layer2`): color, Standard: "#807d78"
- Schicht 4 (Sand) (`layer3`): color, Standard: "#d6c48f"
- Gras (`grass`): boolean, Standard: true
- Büschel pro m² (`grassDensity`): number, Standard: 2
- Grashöhe (`grassHeight`): number, Standard: 0.55
- Grasfarbe (`grassColor`): color, Standard: "#7fb24a"
- Wächst auf Schicht (`grassLayer`): number, Standard: 1
- Kein Gras unterhalb (`grassMinHeight`): number, Standard: -1000

### Wasser

`water`

Eine Wasserfläche mit Wellen, Spiegelung und Sonnenglitzern. Die Oberfläche liegt auf der Höhe des Objekts. Figuren schwimmen darin, wenn „Man kann schwimmen“ an ist. Die Grafikstufe bestimmt die Spiegelung.

**In Unity:** `Water`

**Felder:**

- Breite (`width`): number, Standard: 20
- Länge (`depth`): number, Standard: 20
- Farbe (flach) (`shallowColor`): color, Standard: "#3ea5bc"
- Farbe (tief) (`deepColor`): color, Standard: "#0c3a58"
- Wellenhöhe (`waveHeight`): number, Standard: 0.12
- Wellentempo (`waveSpeed`): number, Standard: 1
- Klarheit (`clarity`): number, Standard: 0.5
- Man kann schwimmen (`swimmable`): boolean, Standard: true

### Nav-Agent

`navAgent`

Lässt das Objekt auf dem Navigationsnetz zu einem Ziel laufen, um Hindernisse und andere Agenten herum. Die Wegfindung ist an, sobald das Navigationsnetz berechnet ist (Fenster Navigation). Mit den NPC-Komponenten (Wandern, Patrouille, Folgen …) oder dem Block „gehe zu …“ bekommt der Agent seine Ziele.

**In Unity:** `NavMeshAgent`

**Felder:**

- Geschwindigkeit (m/s) (`speed`): number, Standard: 3.5
- Beschleunigung (`acceleration`): number, Standard: 12
- Anhalteabstand (`stoppingDistance`): number, Standard: 0.3
- Drehtempo (°/s) (`turnSpeed`): number, Standard: 540
- Radius (`radius`): number, Standard: 0.4
- Höhe (`height`): number, Standard: 1.8
- Anderen ausweichen (`avoidance`): boolean, Standard: true

### Nav-Hindernis

`navObstacle`

Legt fest, wie das Objekt in das Navigationsnetz eingeht: als zusätzliche Box, um die Agenten herumlaufen, oder gar nicht („Ignorieren“, etwa für Zierrat, der im Weg liegt, aber nicht blockiert). Ohne diese Komponente zählen die festen Collider des Objekts.

**In Unity:** `NavMeshObstacle`

**Felder:**

- Modus (`mode`): Optionen: Hindernis (Box), Ignorieren, Standard: "obstacle"
- Mitte (`center`): vector3, Standard: [0,0.5,0]
- Grösse (`size`): vector3, Standard: [1,1,1]

### NPC

`npc`

Gibt dem Objekt einen Zustand (zum Beispiel „patrol“ oder „chase“). Die Verhaltens-Komponenten (Wandern, Patrouille, Folgen, Fliehen, Angreifen …) laufen nur in ihrem Zustand, Wachen wechseln ihn, wenn sie jemanden sehen. Im Spiel steht der Zustand über dem NPC; mit den Blöcken „Wenn Zustand“ und „wechsle Zustand“ baust du eigenes Verhalten.

**In Unity:** `Animator (state machine)`

**Felder:**

- Start-Zustand (`startState`): string, Standard: "patrol"
- Zustand im Spiel anzeigen (`showState`): boolean, Standard: true
- Höhe der Anzeige (`labelHeight`): number, Standard: 2.3

### Wandern

`wander`

Der NPC läuft immer wieder zu zufälligen Punkten im Umkreis seines Startplatzes und bleibt dazwischen stehen. Braucht einen Nav-Agenten und das Navigationsnetz.

**In Unity:** `NavMeshAgent (random destinations)`

**Felder:**

- Radius (`radius`): number, Standard: 8
- Pause (kürzeste) (`minPause`): number, Standard: 1
- Pause (längste) (`maxPause`): number, Standard: 4
- Geschwindigkeit (m/s) (`speed`): number, Standard: 1.6
- Aktiv im Zustand (`activeInState`): string, Standard: "wander"

### Patrouille

`patrol`

Der NPC läuft die Wegpunkte ab: die Kinder des Objekts im Feld „Wegpunkte“, in der Reihenfolge der Hierarchie. Am Ende geht er im Kreis weiter oder läuft zurück. Nach einer Unterbrechung (zum Beispiel einer Verfolgung) macht er am nächsten Wegpunkt weiter.

**In Unity:** `NavMeshAgent (waypoints)`

**Felder:**

- Wegpunkte (Eltern-Objekt) (`route`): object, Standard: keine
- Ablauf (`mode`): Optionen: Rundweg, Hin und zurück, Standard: "loop"
- Wartezeit am Punkt (`wait`): number, Standard: 1
- Geschwindigkeit (m/s) (`speed`): number, Standard: 1.8
- Aktiv im Zustand (`activeInState`): string, Standard: "patrol"

### Folgen

`follow`

Der NPC läuft dem nächsten Objekt mit dem Ziel-Tag hinterher, um Hindernisse herum, und bleibt im eingestellten Abstand stehen. Läuft nur im Zustand „chase“ (anpassbar); eine Wache setzt ihn dorthin, wenn sie das Ziel sieht.

**In Unity:** `NavMeshAgent (SetDestination)`

**Felder:**

- Ziel-Tag (`targetTag`): string, Standard: "Player"
- Abstand (`distance`): number, Standard: 1.6
- Geschwindigkeit (m/s) (`speed`): number, Standard: 3.6
- Aktiv im Zustand (`activeInState`): string, Standard: "chase"

### Fliehen

`flee`

Der NPC läuft vom nächsten Objekt mit dem Ziel-Tag weg, bis der sichere Abstand erreicht ist. Läuft nur im Zustand „flee“ (anpassbar).

**In Unity:** `NavMeshAgent (flee)`

**Felder:**

- Ziel-Tag (`targetTag`): string, Standard: "Player"
- Sicherer Abstand (`safeDistance`): number, Standard: 14
- Geschwindigkeit (m/s) (`speed`): number, Standard: 4.5
- Aktiv im Zustand (`activeInState`): string, Standard: "flee"

### Wache

`guard`

Die Wache sieht Objekte mit dem Ziel-Tag im Sichtkegel (nicht durch Wände) und hört sie in der Hörweite. Bemerkt sie jemanden, wechselt der NPC in den Zustand „chase“; verliert sie ihn für die eingestellte Zeit, geht er zurück in den Zustand „patrol“. Der Sichtkegel ist in der Szenenansicht zu sehen, wenn das Objekt ausgewählt ist.

**In Unity:** `Physics.Raycast + field of view`

**Felder:**

- Ziel-Tag (`targetTag`): string, Standard: "Player"
- Sichtweite (`viewDistance`): number, Standard: 14
- Sichtkegel (Öffnungswinkel) (`viewAngle`): number, Standard: 110
- Hörweite (`hearingRadius`): number, Standard: 4
- Augenhöhe (`eyeHeight`): number, Standard: 1.6
- Zustand bei Entdeckung (`seenState`): string, Standard: "chase"
- Zustand bei Verlust (`lostState`): string, Standard: "patrol"
- Verlust nach (`loseTime`): number, Standard: 4
- Aktiv im Zustand (leer = immer) (`activeInState`): string, Standard: ""

### Angreifen

`attack`

Der NPC greift das nächste Objekt mit dem Ziel-Tag an, sobald es in Reichweite ist: Er dreht sich hin, holt kurz aus (spielt die Angriffs-Animation) und trifft, wenn das Ziel dann noch da ist. Nahkampf trifft im Kegel vor ihm, Fernkampf trifft aus der Ferne, wenn nichts im Weg ist. Läuft nur im Zustand „chase“ (anpassbar).

**In Unity:** `Enemy attack (custom component)`

**Felder:**

- Art (`mode`): Optionen: Nahkampf, Fernkampf, Standard: "melee"
- Ziel-Tag (`targetTag`): string, Standard: "Player"
- Reichweite (`range`): number, Standard: 1.9
- Schaden (`damage`): number, Standard: 10
- Pause zwischen Angriffen (`cooldown`): number, Standard: 1.2
- Ausholen (`windup`): number, Standard: 0.35
- Aktiv im Zustand (`activeInState`): string, Standard: "chase"

### Inventar

`inventory`

Das Inventar des Spielers: Gegenstände mit Namen und Anzahl. „Start-Gegenstände“ nimmt eine Liste wie „Schlüssel:1, Münze:5“. Die Blöcke „füge … zum Inventar hinzu“, „habe ich …?“ und „Anzahl“ arbeiten damit; Truhen, Aufhebbares und Dialoge legen hier ab. Auch ohne die Komponente bekommt ein Objekt beim ersten Gegenstand ein Inventar.

**In Unity:** `Inventory (custom component)`

**Felder:**

- Start-Gegenstände (`startItems`): string, Standard: ""

### Lebenspunkte

`health`

Lebenspunkte für Spieler, Gegner und Dinge, die kaputtgehen. Angriffe, Geschosse und der Block „füge … Schaden zu“ ziehen sie ab, „heile“ gibt welche zurück. Nach einem Treffer ist das Objekt kurz unverwundbar. Bei null: zerstören, wiederbeleben (am letzten Checkpoint) oder nur das Ereignis „Wenn ich besiegt werde“ auslösen.

**In Unity:** `Health (custom component)`

**Felder:**

- Maximale Lebenspunkte (`max`): number, Standard: 100
- Unverwundbar nach Treffer (`invulnerable`): number, Standard: 0.4
- Bei Tod (`onDeath`): Optionen: Objekt zerstören, Wiederbeleben, Nichts (nur Ereignis), Standard: "destroy"
- Wiederbelebung nach (`respawnDelay`): number, Standard: 2

### Nahkampf-Treffer

`meleeHit`

Die Angriffstaste (F, Gamepad X) schlägt zu: Alles mit Lebenspunkten im Kegel vor der Figur wird getroffen. Spielt die Angriffs-Animation, wenn das Modell eine hat.

**In Unity:** `Melee attack (custom component)`

**Felder:**

- Schaden (`damage`): number, Standard: 25
- Reichweite (`range`): number, Standard: 2.2
- Winkel (`angle`): number, Standard: 120
- Pause zwischen Schlägen (`cooldown`): number, Standard: 0.5
- Trifft nur Tag (leer = alle) (`hitsTag`): string, Standard: ""

### Geschoss

`projectile`

Fliegt geradeaus (in Blickrichtung des Objekts), trifft das erste Objekt mit Lebenspunkten und verschwindet danach oder nach der Lebensdauer. Mit dem Block „erzeuge Prefab“ abfeuern, am besten bei einem Objekt, das in die Zielrichtung schaut.

**In Unity:** `Projectile (custom component)`

**Felder:**

- Tempo (m/s) (`speed`): number, Standard: 14
- Schaden (`damage`): number, Standard: 10
- Lebensdauer (`lifetime`): number, Standard: 4
- Trefferradius (`radius`): number, Standard: 0.6
- Ignoriert Tag (z. B. den Schützen) (`ignoreTag`): string, Standard: ""
- Effekt beim Treffer (`effect`): Optionen: Funken, Explosion, Rauch, Standard: "sparks"

### Aufhebbar

`pickup`

Ein Gegenstand zum Einsammeln. Wer ihn berührt (oder mit „Benutzen“ aufhebt), bekommt ihn ins Inventar; das Objekt verschwindet mit Klang und Glitzern.

**In Unity:** `Collectible (custom component)`

**Felder:**

- Gegenstand (`item`): string, Standard: "Münze"
- Anzahl (`count`): number, Standard: 1
- Aufheben (`mode`): Optionen: Beim Berühren, Mit „Benutzen“, Standard: "touch"
- Reichweite (`radius`): number, Standard: 1.2
- Dreht sich (`spin`): boolean, Standard: true
- Klang (`sound`): string, Standard: "coin"
- Effekt (`effect`): Optionen: Glitzer, Funken, Keiner, Standard: "sparkle"

### Ansprechbar

`talkable`

Der Spieler kann das Objekt mit „Benutzen“ (E, Gamepad Y) ansprechen. Dann öffnet sich der gewählte Dialog aus dem Dialog-Editor; die Antworten starten „Wenn Dialogantwort …“ und können Gegenstände geben oder nehmen.

**In Unity:** `Dialogue trigger (custom component)`

**Felder:**

- Dialog (`dialog`): asset (dialog), Standard: keine
- Anzeigename (leer: Objektname) (`name`): string, Standard: ""
- Reichweite (`radius`): number, Standard: 2.5
- Dreht sich zum Spieler (`faceUser`): boolean, Standard: true

### UI-Leinwand

`uiCanvas`

Zeigt eine UI-Leinwand (aus dem UI-Editor) über dem Spiel: HUD, Menüs, Hinweise. Bei geteiltem Bildschirm kann jede Leinwand zu einem Spieler gehören. „Solange das Spiel pausiert ist“ ist für das Pausemenü, „von Hand“ für Menüs, die ein Knopf oder der Block „zeige UI“ öffnet.

**In Unity:** `Canvas`

**Felder:**

- UI-Leinwand (`ui`): asset (ui), Standard: keine
- Für Spieler (`player`): Optionen: Alle Spieler, Spieler 1, Spieler 2, Standard: "all"
- Sichtbar (`visibility`): Optionen: Immer, Solange das Spiel pausiert ist, Von Hand (Block oder Knopf), Standard: "always"
- Reihenfolge (grösser = weiter vorne) (`sortOrder`): number, Standard: 0

### Benutzbar

`usable`

Der Spieler kann das Objekt mit „Benutzen“ (E, Gamepad Y) auslösen, wenn er davorsteht. Es startet „Wenn ich benutzt werde“ und kann eine Nachricht senden; auf Wunsch braucht es einen Gegenstand (zum Beispiel einen Hebelgriff).

**In Unity:** `Interactable (custom component)`

**Felder:**

- Hinweis-Text (leer = Standard) (`prompt`): string, Standard: ""
- Reichweite (`radius`): number, Standard: 2.2
- Braucht Gegenstand (`requires`): string, Standard: ""
- Gegenstand verbrauchen (`consume`): boolean, Standard: false
- Nur einmal (`once`): boolean, Standard: false
- Nachricht senden (an alle) (`message`): string, Standard: ""

### Tür

`door`

Eine Tür oder ein Tor. Es wird verschoben, hochgezogen oder aufgeschwungen; solange es zu ist, sperren die Collider des Objekts den Weg. Mit einem Schlüssel-Gegenstand ist es verschlossen. Schalter, Hebel und die Blöcke „öffne“ und „schliesse“ bedienen es, der Spieler mit „Benutzen“. Der Drehpunkt beim Aufschwingen ist der Ursprung des Objekts.

**In Unity:** `Door (custom component)`

**Felder:**

- Anfangs offen (`open`): boolean, Standard: false
- Art (`style`): Optionen: Zur Seite schieben, Hochziehen, Aufschwingen, Standard: "slide"
- Weg beim Öffnen (`distance`): number, Standard: 2.5
- Winkel beim Aufschwingen (`angle`): number, Standard: 100
- Dauer (`duration`): number, Standard: 1
- Schlüssel (Gegenstand) (`key`): string, Standard: ""
- Schlüssel verbrauchen (`consumeKey`): boolean, Standard: false
- Mit „Benutzen“ bedienbar (`interact`): boolean, Standard: true
- Reichweite (`radius`): number, Standard: 2.6

### Schalter

`switch`

Ein Hebel oder Knopf. Mit „Benutzen“ schaltet der Spieler ihn um: eine verbundene Tür öffnet oder schließt sich, und er kann Nachrichten senden („Wenn ich Nachricht … empfange“). Der Zustand ist als Block „ist Schalter an?“ nicht nötig – benutze die Nachrichten.

**In Unity:** `Lever (custom component)`

**Felder:**

- Bedient (Tür oder Truhe) (`target`): object, Standard: keine
- Anfangs an (`on`): boolean, Standard: false
- Nachricht beim Einschalten (`messageOn`): string, Standard: ""
- Nachricht beim Ausschalten (`messageOff`): string, Standard: ""
- Reichweite (`radius`): number, Standard: 2

### Truhe

`chest`

Eine Truhe mit Inhalt. Mit „Benutzen“ geht sie auf (falls nötig, mit Schlüssel) und der Inhalt wandert ins Inventar des Öffners. Ein Kind-Objekt namens „Deckel“ oder „Lid“ klappt dabei auf. Danach ist die Truhe leer.

**In Unity:** `Chest (custom component)`

**Felder:**

- Inhalt (z. B. Schlüssel:1, Münze:5) (`contents`): string, Standard: "Münze:5"
- Schlüssel (Gegenstand) (`key`): string, Standard: ""
- Schlüssel verbrauchen (`consumeKey`): boolean, Standard: false
- Reichweite (`radius`): number, Standard: 2.2

### Zerstörbar

`destructible`

Das Objekt geht nach einigen Treffern (Nahkampf, Geschosse, „füge … Schaden zu“) kaputt, mit Effekt und Klang. Jeder Treffer zieht einen Lebenspunkt ab.

**In Unity:** `Destructible (custom component)`

**Felder:**

- Hält Treffer aus (`hits`): number, Standard: 3
- Effekt beim Zerstören (`effect`): Optionen: Explosion, Rauch, Funken, Staub, Standard: "explosion"
- Klang beim Zerstören (`sound`): string, Standard: "explosion"

### Checkpoint

`checkpoint`

Wenn ein Spieler in den Radius kommt, merkt sich das Spiel diese Stelle. Wer mit „Wiederbeleben“ (Komponente Lebenspunkte) besiegt wird, kommt hier zurück.

**In Unity:** `Checkpoint (custom component)`

**Felder:**

- Radius (`radius`): number, Standard: 2.5
- Ziel-Tag (`targetTag`): string, Standard: "Player"

### Audio-Quelle

`audioSource`

Spielt einen Klang ab. Mit „3D-Klang“ wird er mit der Entfernung leiser und kommt aus der Richtung des Objekts. Eingebaute Klänge und importierte Dateien (WAV, OGG, MP3) funktionieren gleich.

**In Unity:** `Audio Source`

**Felder:**

- Klang (`sound`): asset (sound), Standard: keine
- Lautstärke (`volume`): number, Standard: 1
- Tonhöhe (`pitch`): number, Standard: 1
- Wiederholen (`loop`): boolean, Standard: false
- Beim Start abspielen (`playOnAwake`): boolean, Standard: true
- Kanal (`bus`): Optionen: Musik, Effekte, Stimmen, Standard: "effects"
- 3D-Klang (`spatial`): boolean, Standard: true
- Volle Lautstärke bis (`minDistance`): number, Standard: 1
- Nicht mehr hörbar ab (`maxDistance`): number, Standard: 30

### Audio-Listener

`audioListener`

Die „Ohren“ des Spiels: Klänge werden von der Stelle dieses Objekts aus gehört. Ohne Audio-Listener hört man von der Kamera aus.

**In Unity:** `Audio Listener`

### Licht

`light`

Beleuchtet die Szene. Ein gerichtetes Licht ist die Sonne und bestimmt den Himmel.

**In Unity:** `Light`

**Felder:**

- Typ (`lightType`): Optionen: Gerichtet (Sonne), Punkt, Spot, Standard: "directional"
- Farbe (`color`): color, Standard: "#fff1de"
- Stärke (`intensity`): number, Standard: 4.6
- Reichweite (`range`): number, Standard: 10
- Spot-Winkel (`spotAngle`): number, Standard: 30
- Wirft Schatten (`castShadows`): boolean, Standard: true

### Block-Skript

`blockScript`

Führt die Blöcke eines Block-Skripts für dieses Objekt aus.

**In Unity:** `MonoBehaviour (C# script)`

**Felder:**

- Skript (`script`): asset (blockScript), Standard: keine

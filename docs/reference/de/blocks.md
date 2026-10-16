# Blöcke

Erzeugt aus dem Blockkatalog und den Komponentendefinitionen. Nicht von Hand ändern.

## Ereignisse

#### Wenn Spiel startet

`events.whenGameStarts` · Form: Ereignis (Hut) · Seit Katalogversion 1

Startet das Skript einmal, wenn das Spiel beginnt (Unity: Start).

**In Unity:** `MonoBehaviour.Start`

#### Jeden Frame

`events.everyFrame` · Form: Ereignis (Hut) · Seit Katalogversion 1

Startet das Skript in jedem Frame (60-mal pro Sekunde), wenn es nicht noch läuft (Unity: Update).

**In Unity:** `MonoBehaviour.Update`

#### Wenn Taste {key} {mode}

`events.whenKey` · Form: Ereignis (Hut) · Seit Katalogversion 1

Startet das Skript, wenn die Taste gedrückt wird, solange sie gehalten wird oder wenn sie losgelassen wird.

**In Unity:** `Input.GetKeyDown / GetKey / GetKeyUp`

**Eingaben:**

- `key`: Optionen: Leertaste, Pfeil nach oben, Pfeil nach unten, Pfeil nach links, Pfeil nach rechts, beliebige, A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, P, Q, R, S, T, U, V, W, X, Y, Z, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, Eingabe, Umschalt
- `mode`: Optionen: gedrückt, gehalten, losgelassen

#### Wenn dieses Objekt angeklickt wird

`events.whenClicked` · Form: Ereignis (Hut) · Seit Katalogversion 1

Startet das Skript, wenn das Objekt in der Spielansicht angeklickt wird.

**In Unity:** `MonoBehaviour.OnMouseDown`

#### Wenn ich {target} {phase}

`events.whenTouching` · Form: Ereignis (Hut) · Seit Katalogversion 1

Startet das Skript, wenn die Collider dieses Objekts ein Objekt oder ein Objekt mit dem Tag berühren (Unity: OnTriggerEnter/Stay/Exit).

**In Unity:** `OnCollisionEnter/Stay/Exit, OnTriggerEnter/Stay/Exit`

**Eingaben:**

- `target`: object, tag or asset (touchTarget)
- `phase`: Optionen: beginne zu berühren, berühre, aufhöre zu berühren

#### Wenn {target} diese Zone {phase}

`events.whenZone` · Form: Ereignis (Hut) · Seit Katalogversion 3

Startet das Skript auf einem Objekt mit einem Collider mit „Ist Trigger“, wenn ein Objekt oder ein Objekt mit dem Tag die Zone betritt oder verlässt (Unity: OnTriggerEnter/Exit).

**In Unity:** `OnTriggerEnter/Stay/Exit on a trigger collider`

**Eingaben:**

- `target`: object, tag or asset (touchTarget)
- `phase`: Optionen: betritt, verlässt

#### Wenn Aktion {action} {phase} für {player}

`events.whenAction` · Form: Ereignis (Hut) · Seit Katalogversion 3

Startet das Skript, wenn die Eingabe-Aktion eines Spielers ausgelöst wird. Funktioniert mit Tastatur, Maus und Gamepad (Unity: Input Actions).

**In Unity:** `InputAction.performed (Input System)`

**Eingaben:**

- `action`: Optionen: Springen, Rennen, Ducken, Interagieren, Angreifen, Pause
- `phase`: Optionen: ausgelöst, gehalten, beendet
- `player`: Optionen: jeden Spieler, Spieler 1, Spieler 2

#### Wenn Animation {animation} {phase}

`events.whenAnimation` · Form: Ereignis (Hut) · Seit Katalogversion 3

Startet das Skript, wenn eine mit „spiele Animation“ gestartete Animation anfängt oder zu Ende ist. Der Name ist ein Standardzustand (z. B. wave) oder ein Clip-Name.

**In Unity:** `Animation Event / StateMachineBehaviour`

**Eingaben:**

- `animation`: text
- `phase`: Optionen: beendet, gestartet

#### Wenn ich {ability}: {phase}

`events.whenAbility` · Form: Ereignis (Hut) · Seit Katalogversion 3

Startet das Skript, wenn die Figur eine Fähigkeit benutzt (Rolle, Gleiten, Doppelsprung) oder damit aufhört.

**In Unity:** kein direktes Gegenstück (eine Blockwerk-Ergänzung)

**Eingaben:**

- `ability`: Optionen: rolle, gleite, doppelspringe
- `phase`: Optionen: beginne, höre auf

#### Wenn ich Nachricht {message} empfange

`events.whenMessage` · Form: Ereignis (Hut) · Seit Katalogversion 5

Startet das Skript, wenn dem Objekt diese Nachricht geschickt wird (Block „sende Nachricht“, auch von Schaltern und Truhen). Zugestellt wird am Anfang des nächsten Ticks.

**In Unity:** `SendMessage / UnityEvent`

**Eingaben:**

- `message`: text

#### Wenn Timer {name} abläuft

`events.whenTimer` · Form: Ereignis (Hut) · Seit Katalogversion 5

Startet das Skript, wenn ein mit „starte Timer“ gestarteter Timer dieses Objekts abgelaufen ist.

**In Unity:** `Invoke / Coroutine with WaitForSeconds`

**Eingaben:**

- `name`: text

#### Wenn ich erstellt werde

`events.whenCreated` · Form: Ereignis (Hut) · Seit Katalogversion 1

Startet das Skript in einer neu erzeugten Kopie dieses Objekts.

**In Unity:** `MonoBehaviour.Awake`

#### Wenn ich zerstört werde

`events.whenDestroyed` · Form: Ereignis (Hut) · Seit Katalogversion 1

Läuft kurz bevor das Objekt zerstört wird (Unity: OnDestroy).

**In Unity:** `MonoBehaviour.OnDestroy`

## Bewegung

#### gehe {meters} Meter {direction}

`motion.move` · Form: Befehl · Seit Katalogversion 1

Bewegt das Objekt in Blickrichtung, zur Seite oder nach oben und unten.

**In Unity:** `Transform.Translate`

**Eingaben:**

- `meters`: number
- `direction`: Optionen: vorwärts, rückwärts, links, rechts, hoch, runter

#### drehe dich um {degrees} Grad {direction}

`motion.turn` · Form: Befehl · Seit Katalogversion 1

Dreht das Objekt nach links, rechts, oben oder unten.

**In Unity:** `Transform.Rotate`

**Eingaben:**

- `degrees`: number
- `direction`: Optionen: rechts, links, hoch, runter

#### gehe zu x: {x} y: {y} z: {z}

`motion.goToXYZ` · Form: Befehl · Seit Katalogversion 1

Setzt die Position (in Metern).

**In Unity:** `Transform.position`

**Eingaben:**

- `x`: number
- `y`: number
- `z`: number

#### gehe zu {target}

`motion.goToObject` · Form: Befehl · Seit Katalogversion 1

Springt an die Position eines Objekts oder des Mauszeigers.

**In Unity:** `Transform.position = other.position`

**Eingaben:**

- `target`: object, tag or asset (objectOrMouse)

#### bewege dich in {seconds} s zu {target} {easing}

`motion.glideToObject` · Form: Befehl · Seit Katalogversion 1

Bewegt das Objekt in der angegebenen Zeit zu einem Objekt oder zum Mauszeiger.

**In Unity:** `Vector3.Lerp / LeanTween.move`

**Eingaben:**

- `seconds`: number
- `target`: object, tag or asset (objectOrMouse)
- `easing`: Optionen: weich, linear, federnd

#### bewege dich in {seconds} s zu x: {x} y: {y} z: {z} {easing}

`motion.glideToXYZ` · Form: Befehl · Seit Katalogversion 1

Bewegt das Objekt in der angegebenen Zeit zu einer Position.

**In Unity:** `Vector3.Lerp / LeanTween.move`

**Eingaben:**

- `seconds`: number
- `x`: number
- `y`: number
- `z`: number
- `easing`: Optionen: weich, linear, federnd

#### schaue zu {target}

`motion.lookAt` · Form: Befehl · Seit Katalogversion 1

Dreht das Objekt waagrecht zu einem Objekt oder zum Mauszeiger.

**In Unity:** `Transform.LookAt`

**Eingaben:**

- `target`: object, tag or asset (objectOrMouse)

#### setze Drehung auf x: {x} y: {y} z: {z}

`motion.setRotation` · Form: Befehl · Seit Katalogversion 1

Setzt die Drehung in Grad (wie im Inspektor).

**In Unity:** `Transform.eulerAngles`

**Eingaben:**

- `x`: number
- `y`: number
- `z`: number

#### setze Skalierung auf x: {x} y: {y} z: {z}

`motion.setScale` · Form: Befehl · Seit Katalogversion 1

Setzt die Skalierung (wie im Inspektor).

**In Unity:** `Transform.localScale`

**Eingaben:**

- `x`: number
- `y`: number
- `z`: number

#### {axis}-Position

`motion.position` · Form: Wert · Seit Katalogversion 1

Die Position des Objekts in der Welt (Meter).

**In Unity:** `Transform.position`

**Eingaben:**

- `axis`: Optionen: x, y, z

#### Blickrichtung

`motion.heading` · Form: Wert · Seit Katalogversion 1

Blickrichtung in Grad: 0 schaut nach +Z, 90 nach +X.

**In Unity:** `Transform.eulerAngles.y`

#### {property} von {target}

`motion.propertyOf` · Form: Wert · Seit Katalogversion 1

Eine Eigenschaft eines anderen Objekts.

**In Unity:** `GetComponent<Transform>()`

**Eingaben:**

- `property`: Optionen: x-Position, y-Position, z-Position, Blickrichtung, Grösse
- `target`: object, tag or asset (object)

## Aussehen

#### spiele Animation {name} {mode} mit Überblendung {fade} s

`looks.playAnimation` · Form: Befehl · Seit Katalogversion 3

Spielt eine Animation des Modells ab. Der Name ist ein Standardzustand (wave, cheer, attack, hit, death, interact …) oder ein Clip-Name. Danach übernimmt die Steuerung wieder.

**In Unity:** `Animator.CrossFade`

**Eingaben:**

- `name`: text
- `mode`: Optionen: einmal, in Schleife
- `fade`: number

#### setze Farbe auf {color}

`looks.setColor` · Form: Befehl · Seit Katalogversion 1

Ändert die Farbe des Materials im Modell-Renderer.

**In Unity:** `Renderer.material.color`

**Eingaben:**

- `color`: color

#### zeige dich

`looks.show` · Form: Befehl · Seit Katalogversion 1

Macht das Objekt sichtbar.

**In Unity:** `Renderer.enabled = true`

#### verstecke dich

`looks.hide` · Form: Befehl · Seit Katalogversion 1

Macht das Objekt unsichtbar. Unsichtbare Objekte berühren nichts.

**In Unity:** `Renderer.enabled = false`

#### setze Grösse auf {percent} %

`looks.setSize` · Form: Befehl · Seit Katalogversion 1

Setzt die Grösse in Prozent der Skalierung aus der Szene.

**In Unity:** `Transform.localScale`

**Eingaben:**

- `percent`: number

#### {action} {target}

`looks.setActive` · Form: Befehl · Seit Katalogversion 1

Aktiviert oder deaktiviert ein Objekt samt Kindern (Unity: SetActive). Deaktivierte Objekte sind unsichtbar und ihre Skripte pausieren.

**In Unity:** `GameObject.SetActive`

**Eingaben:**

- `action`: Optionen: aktiviere, deaktiviere
- `target`: object, tag or asset (object)

## Klang

#### spiele Klang {sound} {where}

`sound.play` · Form: Befehl · Seit Katalogversion 4

Spielt einen Klang einmal. „hier“ ist ein 3D-Klang an der Stelle des Objekts: leiser mit der Entfernung, aus der richtigen Richtung. „überall“ klingt gleich laut, egal wo man ist.

**In Unity:** `AudioSource.PlayOneShot`

**Eingaben:**

- `sound`: object, tag or asset (sound)
- `where`: Optionen: hier, überall

#### spiele Musik {sound} in Schleife

`sound.playMusic` · Form: Befehl · Seit Katalogversion 4

Spielt Musik in einer Endlosschleife. Läuft schon andere Musik, blendet sie über.

**In Unity:** `AudioSource.Play with loop = true`

**Eingaben:**

- `sound`: object, tag or asset (sound)

#### blende Musik über zu {sound} in {seconds} s

`sound.crossfadeMusic` · Form: Befehl · Seit Katalogversion 4

Blendet die laufende Musik langsam aus und das neue Stück gleichzeitig ein.

**In Unity:** `AudioMixer snapshot transition`

**Eingaben:**

- `sound`: object, tag or asset (sound)
- `seconds`: number

#### stoppe alle Klänge

`sound.stopAll` · Form: Befehl · Seit Katalogversion 4

Stoppt alle Klänge und die Musik.

**In Unity:** `AudioSource.Stop`

#### setze Lautstärke {channel} auf {percent} %

`sound.setVolume` · Form: Befehl · Seit Katalogversion 4

Stellt die Lautstärke eines Kanals ein: Musik, Effekte oder Stimmen (0 bis 100 %).

**In Unity:** `AudioMixer.SetFloat`

**Eingaben:**

- `channel`: Optionen: Musik, Effekte, Stimmen
- `percent`: number

## Steuerung

#### warte {seconds} s

`control.wait` · Form: Befehl · Seit Katalogversion 1

Wartet die angegebene Zeit.

**In Unity:** `yield return new WaitForSeconds`

**Eingaben:**

- `seconds`: number

#### wiederhole fortlaufend

`control.forever` · Form: C-förmiger Befehl · Seit Katalogversion 1

Führt den Inhalt immer wieder aus, einmal pro Frame.

**In Unity:** `while (true) { ... yield return null; }`

**Eingaben:**

- `body`: blocks

#### wiederhole {times} mal

`control.repeat` · Form: C-förmiger Befehl · Seit Katalogversion 1

Führt den Inhalt so oft aus. Nach jedem Durchlauf folgt der nächste Frame.

**In Unity:** `for loop`

**Eingaben:**

- `times`: number
- `body`: blocks

#### wiederhole bis {condition}

`control.repeatUntil` · Form: C-förmiger Befehl · Seit Katalogversion 1

Führt den Inhalt aus, bis die Bedingung wahr ist.

**In Unity:** `while loop`

**Eingaben:**

- `condition`: true/false
- `body`: blocks

#### falls {condition} dann

`control.if` · Form: C-förmiger Befehl · Seit Katalogversion 1

Führt den Inhalt nur aus, wenn die Bedingung wahr ist.

**In Unity:** `if`

**Eingaben:**

- `condition`: true/false
- `then`: blocks

#### falls {condition} dann

`control.ifElse` · Form: C-förmiger Befehl · Seit Katalogversion 1

Führt den oberen Teil aus, wenn die Bedingung wahr ist, sonst den unteren.

**In Unity:** `if / else`

**Eingaben:**

- `condition`: true/false
- `then`: blocks
- `else`: blocks

#### warte bis {condition}

`control.waitUntil` · Form: Befehl · Seit Katalogversion 1

Wartet, bis die Bedingung wahr ist (wird jeden Frame geprüft).

**In Unity:** `yield return new WaitUntil`

**Eingaben:**

- `condition`: true/false

#### erzeuge Kopie von {target}

`control.clone` · Form: Befehl · Seit Katalogversion 1

Erzeugt eine Kopie des Objekts an seiner Stelle (Unity: Instantiate). In der Kopie startet „Wenn ich erstellt werde“.

**In Unity:** `Object.Instantiate`

**Eingaben:**

- `target`: object, tag or asset (object)

#### erzeuge {prefab} bei {at}

`control.spawnPrefab` · Form: Befehl · Seit Katalogversion 1

Erzeugt ein Exemplar eines Prefabs an der Stelle eines Objekts (Unity: Instantiate mit Prefab). Im neuen Objekt startet „Wenn ich erstellt werde“.

**In Unity:** `Object.Instantiate(prefab, position, rotation)`

**Eingaben:**

- `prefab`: object, tag or asset (prefab)
- `at`: object, tag or asset (object)

#### zerstöre {target}

`control.destroy` · Form: Befehl · Seit Katalogversion 1

Entfernt ein Objekt aus dem Spiel (Unity: Destroy). Zerstört es sich selbst, endet das Skript.

**In Unity:** `Object.Destroy`

**Eingaben:**

- `target`: object, tag or asset (object)

#### stoppe {what}

`control.stop` · Form: Befehl (beendet den Stapel) · Seit Katalogversion 1

Beendet dieses Skript oder alle Skripte des Spiels.

**In Unity:** `StopCoroutine / StopAllCoroutines`

**Eingaben:**

- `what`: Optionen: dieses Skript, alle

#### schreibe ins Log {level} {message}

`control.log` · Form: Befehl · Seit Katalogversion 8

Schreibt den Wert in die Konsole. Ein Klick auf den Eintrag springt zu diesem Block. Mit „Warnung“ und „Fehler“ lässt sich nach Meldungen filtern.

**In Unity:** `Debug.Log / LogWarning / LogError`

**Eingaben:**

- `level`: Optionen: Info, Warnung, Fehler
- `message`: any value

#### sende Nachricht {message} an {target}

`control.sendMessage` · Form: Befehl · Seit Katalogversion 5

Schickt eine Nachricht an ein Objekt, an alle Objekte mit einem Tag oder an alle. Empfänger sind Skripte mit „Wenn ich Nachricht … empfange“. Zugestellt wird am Anfang des nächsten Ticks.

**In Unity:** `GameObject.SendMessage / UnityEvent.Invoke`

**Eingaben:**

- `message`: text
- `target`: object, tag or asset (messageTarget)

#### starte Timer {name} mit {seconds} s

`control.startTimer` · Form: Befehl · Seit Katalogversion 5

Startet einen Timer dieses Objekts. Danach läuft das Skript weiter; wenn die Zeit um ist, startet „Wenn Timer … abläuft“. Derselbe Name startet den Timer neu.

**In Unity:** `Invoke / Coroutine`

**Eingaben:**

- `name`: text
- `seconds`: number

#### für jedes Objekt in {target}

`control.forEachObject` · Form: C-förmiger Befehl · Seit Katalogversion 5

Führt den Inhalt für jedes Objekt mit dem Tag aus (oder für alle). Im Inhalt steht „Schleifen-Objekt“ in den Objekt-Auswahlen für das gerade dran. Alle Durchläufe laufen im selben Frame, außer der Inhalt wartet.

**In Unity:** `foreach over FindGameObjectsWithTag`

**Eingaben:**

- `target`: object, tag or asset (touchTarget)
- `body`: blocks

## Fühlen

#### Taste {key} gedrückt?

`sensing.keyPressed` · Form: Bedingung · Seit Katalogversion 1

Wahr, solange die Taste gedrückt ist.

**In Unity:** `Input.GetKey`

**Eingaben:**

- `key`: Optionen: Leertaste, Pfeil nach oben, Pfeil nach unten, Pfeil nach links, Pfeil nach rechts, beliebige, A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, P, Q, R, S, T, U, V, W, X, Y, Z, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, Eingabe, Umschalt

#### berühre ich {target}?

`sensing.touching` · Form: Bedingung · Seit Katalogversion 1

Wahr, wenn die Collider dieses Objekts das Objekt oder ein Objekt mit dem Tag berühren.

**In Unity:** `Collider.bounds.Intersects / OnCollisionStay`

**Eingaben:**

- `target`: object, tag or asset (touchTarget)

#### Abstand zu {target}

`sensing.distanceTo` · Form: Wert · Seit Katalogversion 1

Abstand in Metern.

**In Unity:** `Vector3.Distance`

**Eingaben:**

- `target`: object, tag or asset (objectOrMouse)

#### Maus x

`sensing.mouseX` · Form: Wert · Seit Katalogversion 1

Waagrechte Mausposition in der Spielansicht, in Pixeln ab der Mitte (rechts positiv).

**In Unity:** `Input.mousePosition.x`

#### Maus y

`sensing.mouseY` · Form: Wert · Seit Katalogversion 1

Senkrechte Mausposition in der Spielansicht, in Pixeln ab der Mitte (oben positiv).

**In Unity:** `Input.mousePosition.y`

#### Maustaste gedrückt?

`sensing.mouseDown` · Form: Bedingung · Seit Katalogversion 1

Wahr, solange die Maustaste gedrückt ist.

**In Unity:** `Input.GetMouseButton`

#### Stoppuhr

`sensing.timer` · Form: Wert · Seit Katalogversion 1

Sekunden seit Spielstart oder seit dem letzten Zurücksetzen.

**In Unity:** `Time.time`

#### setze Stoppuhr zurück

`sensing.resetTimer` · Form: Befehl · Seit Katalogversion 1

Setzt die Stoppuhr auf 0.

**In Unity:** kein direktes Gegenstück (eine Blockwerk-Ergänzung)

#### Zufallszahl von {from} bis {to}

`sensing.random` · Form: Wert · Seit Katalogversion 1

Eine Zufallszahl. Sind beide Grenzen ganze Zahlen, ist auch das Ergebnis ganz.

**In Unity:** `Random.Range`

**Eingaben:**

- `from`: number
- `to`: number

## Operatoren

#### {a} + {b}

`operators.add` · Form: Wert · Seit Katalogversion 1

Summe zweier Zahlen.

**In Unity:** `+`

**Eingaben:**

- `a`: number
- `b`: number

#### {a} − {b}

`operators.subtract` · Form: Wert · Seit Katalogversion 1

Differenz zweier Zahlen.

**In Unity:** `-`

**Eingaben:**

- `a`: number
- `b`: number

#### {a} × {b}

`operators.multiply` · Form: Wert · Seit Katalogversion 1

Produkt zweier Zahlen.

**In Unity:** `*`

**Eingaben:**

- `a`: number
- `b`: number

#### {a} ÷ {b}

`operators.divide` · Form: Wert · Seit Katalogversion 1

Quotient zweier Zahlen.

**In Unity:** `/`

**Eingaben:**

- `a`: number
- `b`: number

#### Rest von {a} geteilt durch {b}

`operators.mod` · Form: Wert · Seit Katalogversion 1

Rest der Division, immer mit dem Vorzeichen des Teilers (wie in Scratch).

**In Unity:** `%`

**Eingaben:**

- `a`: number
- `b`: number

#### runde {value}

`operators.round` · Form: Wert · Seit Katalogversion 1

Rundet auf die nächste ganze Zahl.

**In Unity:** `Mathf.Round`

**Eingaben:**

- `value`: number

#### {fn} von {value}

`operators.mathFunction` · Form: Wert · Seit Katalogversion 1

Mathematische Funktion. Winkel in Grad.

**In Unity:** `Mathf.Abs, Floor, Ceil, Sqrt, Sin, Cos`

**Eingaben:**

- `fn`: Optionen: Betrag, abrunden, aufrunden, Wurzel, sin, cos, tan, ln, e ^
- `value`: number

#### kleinere von {a} und {b}

`operators.min` · Form: Wert · Seit Katalogversion 1

Die kleinere der beiden Zahlen.

**In Unity:** `Mathf.Min`

**Eingaben:**

- `a`: number
- `b`: number

#### grössere von {a} und {b}

`operators.max` · Form: Wert · Seit Katalogversion 1

Die grössere der beiden Zahlen.

**In Unity:** `Mathf.Max`

**Eingaben:**

- `a`: number
- `b`: number

#### begrenze {value} auf {low} bis {high}

`operators.clamp` · Form: Wert · Seit Katalogversion 1

Hält eine Zahl zwischen zwei Grenzen.

**In Unity:** `Mathf.Clamp`

**Eingaben:**

- `value`: number
- `low`: number
- `high`: number

#### interpoliere von {a} bis {b} mit {t}

`operators.lerp` · Form: Wert · Seit Katalogversion 1

Wert zwischen zwei Zahlen: 0 ergibt die erste, 1 die zweite (Unity: Mathf.Lerp ohne Begrenzung).

**In Unity:** `Mathf.Lerp`

**Eingaben:**

- `a`: number
- `b`: number
- `t`: number

#### {a} < {b}

`operators.lt` · Form: Bedingung · Seit Katalogversion 1

Wahr, wenn der linke Wert kleiner ist.

**In Unity:** `<`

**Eingaben:**

- `a`: any value
- `b`: any value

#### {a} = {b}

`operators.eq` · Form: Bedingung · Seit Katalogversion 1

Wahr, wenn beide Werte gleich sind (Text ohne Gross-/Kleinschreibung).

**In Unity:** `==`

**Eingaben:**

- `a`: any value
- `b`: any value

#### {a} > {b}

`operators.gt` · Form: Bedingung · Seit Katalogversion 1

Wahr, wenn der linke Wert grösser ist.

**In Unity:** `>`

**Eingaben:**

- `a`: any value
- `b`: any value

#### {a} und {b}

`operators.and` · Form: Bedingung · Seit Katalogversion 1

Wahr, wenn beide Bedingungen wahr sind.

**In Unity:** `&&`

**Eingaben:**

- `a`: true/false
- `b`: true/false

#### {a} oder {b}

`operators.or` · Form: Bedingung · Seit Katalogversion 1

Wahr, wenn mindestens eine Bedingung wahr ist.

**In Unity:** `||`

**Eingaben:**

- `a`: true/false
- `b`: true/false

#### nicht {value}

`operators.not` · Form: Bedingung · Seit Katalogversion 1

Kehrt eine Bedingung um.

**In Unity:** `!`

**Eingaben:**

- `value`: true/false

#### verbinde {a} und {b}

`operators.join` · Form: Wert · Seit Katalogversion 1

Hängt zwei Texte aneinander.

**In Unity:** `string concatenation (+)`

**Eingaben:**

- `a`: text
- `b`: text

#### Länge von {text}

`operators.length` · Form: Wert · Seit Katalogversion 1

Anzahl der Zeichen eines Texts.

**In Unity:** `string.Length`

**Eingaben:**

- `text`: text

#### Zeichen {index} von {text}

`operators.letterOf` · Form: Wert · Seit Katalogversion 1

Ein Zeichen eines Texts, gezählt ab 1.

**In Unity:** `string[index]`

**Eingaben:**

- `index`: number
- `text`: text

#### {text} enthält {part}?

`operators.contains` · Form: Bedingung · Seit Katalogversion 1

Wahr, wenn der Text den Teil enthält (ohne Gross-/Kleinschreibung).

**In Unity:** `string.Contains`

**Eingaben:**

- `text`: text
- `part`: text

## Variablen

#### {variable}

`variables.get` · Form: Wert · Seit Katalogversion 1

Der Wert der Variable.

**In Unity:** `a field of the MonoBehaviour, or a static field`

**Eingaben:**

- `variable`: variable

#### setze {variable} auf {value}

`variables.set` · Form: Befehl · Seit Katalogversion 1

Gibt der Variable einen neuen Wert.

**In Unity:** `assignment to a field`

**Eingaben:**

- `variable`: variable
- `value`: any value

#### ändere {variable} um {by}

`variables.change` · Form: Befehl · Seit Katalogversion 1

Zählt eine Zahl zur Variable dazu (negative Zahlen ziehen ab).

**In Unity:** `compound assignment (+=)`

**Eingaben:**

- `variable`: variable
- `by`: number

#### zeige Anzeige {variable}

`variables.show` · Form: Befehl · Seit Katalogversion 1

Blendet den Wert der Variable in der Spielansicht ein.

**In Unity:** kein direktes Gegenstück (eine Blockwerk-Ergänzung)

**Eingaben:**

- `variable`: variable

#### verstecke Anzeige {variable}

`variables.hide` · Form: Befehl · Seit Katalogversion 1

Blendet die Anzeige der Variable wieder aus.

**In Unity:** kein direktes Gegenstück (eine Blockwerk-Ergänzung)

**Eingaben:**

- `variable`: variable

#### lokale Variable {name} = {value}

`locals.declare` · Form: Befehl · Seit Katalogversion 7

Legt eine Variable an, die nur in diesem Stapel und in dem, was darunter und darin liegt, gilt.

**In Unity:** `local variable declaration`

**Eingaben:**

- `name`: text
- `value`: any value

#### setze lokale {name} auf {value}

`locals.set` · Form: Befehl · Seit Katalogversion 7

Gibt einer lokalen Variable einen neuen Wert.

**In Unity:** `assignment to a local variable`

**Eingaben:**

- `name`: text
- `value`: any value

#### ändere lokale {name} um {by}

`locals.change` · Form: Befehl · Seit Katalogversion 7

Zählt eine Zahl zur lokalen Variable dazu.

**In Unity:** `compound assignment (+=)`

**Eingaben:**

- `name`: text
- `by`: number

#### lokale {name}

`locals.get` · Form: Wert · Seit Katalogversion 7

Der Wert der lokalen Variable.

**In Unity:** `local variable`

**Eingaben:**

- `name`: text

## Spieler

#### setze {setting} auf {value}

`player.setValue` · Form: Befehl · Seit Katalogversion 3

Ändert einen Wert der Steuerung dieses Objekts (Meter pro Sekunde bzw. Meter).

**In Unity:** `fields of the CharacterController / player script`

**Eingaben:**

- `setting`: Optionen: Laufgeschwindigkeit, Renngeschwindigkeit, Sprunghöhe
- `value`: number

#### springe

`player.jump` · Form: Befehl · Seit Katalogversion 3

Lässt die Figur springen, als wäre die Sprungtaste gedrückt worden (mit Sprung-Puffer und Gnadenfrist).

**In Unity:** `CharacterController.Move with a jump velocity`

#### ducke dich

`player.crouch` · Form: Befehl · Seit Katalogversion 3

Duckt die Figur, bis „stehe auf“ folgt.

**In Unity:** `CharacterController.height`

#### stehe auf

`player.standUp` · Form: Befehl · Seit Katalogversion 3

Richtet die Figur wieder auf, sobald über ihr genug Platz ist.

**In Unity:** `CharacterController.height`

#### {state} Steuerung

`player.lockControls` · Form: Befehl · Seit Katalogversion 3

Sperrt die Eingabe der Figur (z. B. in einer Zwischensequenz) oder gibt sie wieder frei.

**In Unity:** `MonoBehaviour.enabled = false`

**Eingaben:**

- `state`: Optionen: sperre, gib frei

#### teleportiere mich zu {target}

`player.teleport` · Form: Befehl · Seit Katalogversion 3

Setzt die Figur an die Position eines Objekts (z. B. eines Checkpoints) und stoppt ihre Bewegung.

**In Unity:** `CharacterController.enabled + Transform.position`

**Eingaben:**

- `target`: object, tag or asset (object)

#### stehe ich auf dem Boden?

`player.onGround` · Form: Bedingung · Seit Katalogversion 3

Wahr, solange die Figur auf dem Boden steht.

**In Unity:** `CharacterController.isGrounded`

#### renne ich?

`player.isRunning` · Form: Bedingung · Seit Katalogversion 3

Wahr, solange die Figur rennt.

**In Unity:** kein direktes Gegenstück (eine Blockwerk-Ergänzung)

#### Geschwindigkeit

`player.speed` · Form: Wert · Seit Katalogversion 3

Waagrechte Geschwindigkeit der Figur in Metern pro Sekunde.

**In Unity:** `CharacterController.velocity.magnitude`

## Kamera

#### wechsle Kamera zu {view}

`camera.switchTo` · Form: Befehl · Seit Katalogversion 3

Schaltet auf die Kamera mit diesem Verhalten um, weich überblendet. Die anderen Kameras des Spielers werden ausgeschaltet.

**In Unity:** `Cinemachine: change the Priority of a virtual camera`

**Eingaben:**

- `view`: Optionen: Third-Person, First-Person, Draufsicht, Seitenansicht, feste Kamera, gemeinsame Kamera

#### wechsle Kamera zu Kamera von {target}

`camera.switchToObject` · Form: Befehl · Seit Katalogversion 3

Schaltet auf die Kamera eines anderen Objekts um, weich überblendet.

**In Unity:** `Cinemachine: change the Priority of a virtual camera`

**Eingaben:**

- `target`: object, tag or asset (object)

#### setze Kamera-Abstand auf {distance}

`camera.setDistance` · Form: Befehl · Seit Katalogversion 3

Ändert den Abstand der Kamera zum Ziel (in Metern).

**In Unity:** `CinemachineFramingTransposer.m_CameraDistance`

**Eingaben:**

- `distance`: number

#### Kamera wackeln Stärke {strength} Dauer {seconds} s

`camera.shake` · Form: Befehl · Seit Katalogversion 3

Lässt die Kamera kurz wackeln. Die Stärke ist ein Winkel in Grad und klingt bis zum Ende ab.

**In Unity:** `Cinemachine Impulse Source`

**Eingaben:**

- `strength`: number
- `seconds`: number

#### Kamerafahrt {target} abspielen

`camera.playPath` · Form: Befehl · Seit Katalogversion 3

Schaltet auf das Objekt mit der Komponente „Kamerafahrt“ um und spielt sie von vorn ab.

**In Unity:** `Cinemachine Dolly Cart`

**Eingaben:**

- `target`: object, tag or asset (object)

#### setze Sichtfeld auf {fov} in {seconds} s

`camera.setFieldOfView` · Form: Befehl · Seit Katalogversion 3

Ändert das Sichtfeld der Kamera (in Grad) weich innerhalb der angegebenen Zeit.

**In Unity:** `Camera.fieldOfView`

**Eingaben:**

- `fov`: number
- `seconds`: number

## Figur

#### hänge {item} an {point}

`character.attach` · Form: Befehl · Seit Katalogversion 3

Hängt einen Gegenstand (ein Modell, z. B. aus der Bibliothek) an einen Halte-Punkt der Figur. Was dort hing, wird ersetzt.

**In Unity:** `Transform.SetParent on a bone`

**Eingaben:**

- `item`: text
- `point`: Optionen: rechte Hand, linke Hand, Rücken, Kopf, Hüfte

#### lege ab, was an {point} hängt

`character.detach` · Form: Befehl · Seit Katalogversion 3

Nimmt den Gegenstand ab, der an diesem Halte-Punkt hängt.

**In Unity:** `Transform.SetParent(null)`

**Eingaben:**

- `point`: Optionen: rechte Hand, linke Hand, Rücken, Kopf, Hüfte

#### wechsle Teil {from} zu {to}

`character.switchPart` · Form: Befehl · Seit Katalogversion 3

Versteckt ein Teil des Modells und zeigt dafür ein anderes (Namen der Teile stehen im Figuren-Studio).

**In Unity:** kein direktes Gegenstück (eine Blockwerk-Ergänzung)

**Eingaben:**

- `from`: text
- `to`: text

#### setze Farbe von Teil {part} auf {color}

`character.setPartColor` · Form: Befehl · Seit Katalogversion 3

Färbt ein Teil des Modells ein (z. B. für Spieler 2).

**In Unity:** `Renderer.material.color`

**Eingaben:**

- `part`: text
- `color`: color

#### wechsle Bewegungs-Profil zu {profile}

`character.setProfile` · Form: Befehl · Seit Katalogversion 3

Setzt Tempo, Sprung, Beschleunigung und Schwerkraft der Figur auf die Werte des Profils.

**In Unity:** kein direktes Gegenstück (eine Blockwerk-Ergänzung)

**Eingaben:**

- `profile`: Optionen: Arcade, Realistisch, Flink, Schwer, Schwebend

#### {state} Fähigkeit {ability}

`character.setAbility` · Form: Befehl · Seit Katalogversion 3

Schaltet eine Fähigkeit der Figur an oder aus (sie muss als Komponente an der Figur hängen).

**In Unity:** kein direktes Gegenstück (eine Blockwerk-Ergänzung)

**Eingaben:**

- `state`: Optionen: aktiviere, deaktiviere
- `ability`: Optionen: Doppelsprung, Rolle, Gleiten, Ausdauer

#### habe ich Fähigkeit {ability}?

`character.hasAbility` · Form: Bedingung · Seit Katalogversion 3

Wahr, wenn die Fähigkeit an der Figur hängt und eingeschaltet ist.

**In Unity:** kein direktes Gegenstück (eine Blockwerk-Ergänzung)

**Eingaben:**

- `ability`: Optionen: Doppelsprung, Rolle, Gleiten, Ausdauer

#### setze Ausdauer auf {percent} %

`character.setStamina` · Form: Befehl · Seit Katalogversion 3

Setzt die Ausdauer der Figur auf einen Prozentwert (0 bis 100).

**In Unity:** kein direktes Gegenstück (eine Blockwerk-Ergänzung)

**Eingaben:**

- `percent`: number

#### Ausdauer in %

`character.stamina` · Form: Wert · Seit Katalogversion 3

Die Ausdauer der Figur in Prozent (100 ohne die Fähigkeit Ausdauer).

**In Unity:** kein direktes Gegenstück (eine Blockwerk-Ergänzung)

## Physik

#### stoße mich an mit Kraft {force} {direction}

`physics.push` · Form: Befehl · Seit Katalogversion 3

Gibt dem Objekt einen Stoß (Impuls) in Blickrichtung oder zur Seite. Braucht einen Rigidbody.

**In Unity:** `Rigidbody.AddForce`

**Eingaben:**

- `force`: number
- `direction`: Optionen: vorwärts, rückwärts, links, rechts, hoch, runter

#### setze Geschwindigkeit auf x: {x} y: {y} z: {z}

`physics.setVelocity` · Form: Befehl · Seit Katalogversion 3

Setzt die Geschwindigkeit des Rigidbodys in Metern pro Sekunde (Weltkoordinaten).

**In Unity:** `Rigidbody.velocity`

**Eingaben:**

- `x`: number
- `y`: number
- `z`: number

#### setze Schwerkraft auf {value}

`physics.setGravity` · Form: Befehl · Seit Katalogversion 3

Setzt die Schwerkraft der ganzen Szene in Metern pro Sekunde zum Quadrat (Erde: 9,81, Mond: 1,62).

**In Unity:** `Physics.gravity / Rigidbody.useGravity`

**Eingaben:**

- `value`: number

#### mache mich {type}

`physics.setBodyType` · Form: Befehl · Seit Katalogversion 3

Macht das Objekt fest (statisch), von der Physik bewegt (dynamisch) oder nur per Skript bewegt (kinematisch).

**In Unity:** `Rigidbody.isKinematic`

**Eingaben:**

- `type`: Optionen: statisch, dynamisch, kinematisch

#### was ist vor mir in {meters} Meter?

`physics.whatIsAhead` · Form: Wert · Seit Katalogversion 3

Name des Objekts direkt vor dem Objekt innerhalb der Strecke, oder leer, wenn nichts da ist (Raycast).

**In Unity:** `Physics.Raycast`

**Eingaben:**

- `meters`: number

#### Abstand voraus bis {meters} Meter

`physics.distanceAhead` · Form: Wert · Seit Katalogversion 3

Abstand zum nächsten Hindernis direkt voraus in Metern, höchstens die angegebene Strecke.

**In Unity:** `Physics.Raycast (RaycastHit.distance)`

**Eingaben:**

- `meters`: number

## NPC und KI

#### Wenn Zustand {state}

`npc.whenState` · Form: Ereignis (Hut) · Seit Katalogversion 5

Startet das Skript, sobald der NPC in diesen Zustand wechselt (Unity: ein Animator-Zustand betreten).

**In Unity:** `Animator state machine (StateMachineBehaviour.OnStateEnter)`

**Eingaben:**

- `state`: text

#### Wenn Dialogantwort {answer}

`dialog.whenAnswer` · Form: Ereignis (Hut) · Seit Katalogversion 5

Startet das Skript, wenn der Spieler im Dialog die Antwort mit dieser Kennung wählt. Die Kennung steht im Dialog-Editor an der Antwort.

**In Unity:** kein direktes Gegenstück (eine Blockwerk-Ergänzung)

**Eingaben:**

- `answer`: text

#### gehe zu {target} (Wegfindung)

`npc.goTo` · Form: Befehl · Seit Katalogversion 5

Der NPC läuft über das Navigationsnetz zu einem Objekt, um Hindernisse herum, und das Skript wartet, bis er angekommen ist. Braucht eine Nav-Agent-Komponente (Unity: NavMeshAgent.SetDestination).

**In Unity:** `NavMeshAgent.SetDestination`

**Eingaben:**

- `target`: object, tag or asset (object)

#### folge {target} mit Abstand {distance}

`npc.follow` · Form: Befehl · Seit Katalogversion 5

Der NPC läuft ab jetzt dem Objekt hinterher und bleibt im Abstand (in Metern) stehen. „Bleib stehen“ oder ein anderer Bewegungsblock beendet das. Bei einem Tag läuft er dem nächsten Objekt nach.

**In Unity:** `NavMeshAgent.SetDestination every frame`

**Eingaben:**

- `target`: object, tag or asset (object)
- `distance`: number

#### fliehe vor {target}

`npc.flee` · Form: Befehl · Seit Katalogversion 5

Der NPC läuft vom Objekt weg, bis er weit genug entfernt ist. „Bleib stehen“ beendet das.

**In Unity:** `NavMeshAgent.SetDestination away from a target`

**Eingaben:**

- `target`: object, tag or asset (object)

#### wandere herum in Radius {radius}

`npc.wander` · Form: Befehl · Seit Katalogversion 5

Der NPC läuft immer wieder zu zufälligen Punkten im Umkreis (in Metern) um den Platz, an dem er jetzt steht.

**In Unity:** `NavMeshAgent.SetDestination with NavMesh.SamplePosition`

**Eingaben:**

- `radius`: number

#### patrouilliere entlang {route}

`npc.patrol` · Form: Befehl · Seit Katalogversion 5

Der NPC läuft die Kinder des Objekts als Wegpunkte ab, in der Reihenfolge der Hierarchie, im Kreis.

**In Unity:** `NavMeshAgent with waypoints`

**Eingaben:**

- `route`: object, tag or asset (object)

#### bleib stehen

`npc.stop` · Form: Befehl · Seit Katalogversion 5

Der NPC bleibt stehen und beendet Folgen, Fliehen, Wandern und Patrouille, die mit Blöcken gestartet wurden.

**In Unity:** `NavMeshAgent.ResetPath`

#### wechsle Zustand zu {state}

`npc.setState` · Form: Befehl · Seit Katalogversion 5

Setzt den Zustand des NPCs. Seine Verhaltens-Komponenten laufen nur in ihrem Zustand (Patrouille in „patrol“, Folgen in „chase“ …).

**In Unity:** `Animator.SetTrigger / SetInteger`

**Eingaben:**

- `state`: text

#### starte Dialog {dialog}

`dialog.start` · Form: Befehl · Seit Katalogversion 5

Zeigt einen Dialog (aus dem Dialog-Editor) und wartet, bis das Gespräch zu Ende ist. Der Spieler kann sich währenddessen nicht bewegen.

**In Unity:** `Dialogue system (Yarn Spinner, Ink)`

**Eingaben:**

- `dialog`: object, tag or asset (dialog)

#### aktueller Zustand

`npc.state` · Form: Wert · Seit Katalogversion 5

Der Name des Zustands, in dem der NPC gerade ist (leer, wenn er keinen hat).

**In Unity:** `Animator.GetCurrentAnimatorStateInfo`

#### sehe ich {target}?

`npc.sees` · Form: Bedingung · Seit Katalogversion 5

Wahr, wenn das Objekt im Sichtkegel des NPCs ist und keine Wand dazwischen steht. Die Werte (Sichtweite, Winkel) kommen von der Wache-Komponente.

**In Unity:** `Physics.Raycast + a field of view check`

**Eingaben:**

- `target`: object, tag or asset (object)

#### höre ich {target}?

`npc.hears` · Form: Bedingung · Seit Katalogversion 5

Wahr, wenn das Objekt innerhalb der Hörweite des NPCs ist (auch hinter Wänden).

**In Unity:** `Physics.OverlapSphere`

**Eingaben:**

- `target`: object, tag or asset (object)

## Umgebung

#### setze Tageszeit auf {hours} Uhr

`environment.setTimeOfDay` · Form: Befehl · Seit Katalogversion 4

Stellt die Uhrzeit des Himmels ein (0 bis 24, 12 ist Mittag). Sonne, Mond, Sterne, Licht und Nebel folgen.

**In Unity:** `Transform.rotation of a Directional Light, RenderSettings.skybox`

**Eingaben:**

- `hours`: number

#### lasse Zeit laufen mit Faktor {factor}

`environment.setTimeSpeed` · Form: Befehl · Seit Katalogversion 4

Lässt die Tageszeit laufen. Faktor 1 ist Echtzeit, 720 macht einen Tag in zwei Minuten, 0 hält die Zeit an.

**In Unity:** `Time.timeScale for a day-night script`

**Eingaben:**

- `factor`: number

#### Tageszeit (Uhr)

`environment.timeOfDay` · Form: Wert · Seit Katalogversion 4

Die aktuelle Tageszeit, 0 bis 24.

**In Unity:** kein direktes Gegenstück (eine Blockwerk-Ergänzung)

#### setze Wetter auf {weather} in {seconds} s

`environment.setWeather` · Form: Befehl · Seit Katalogversion 4

Wechselt das Wetter. Es blendet in der angegebenen Zeit über. Regen und Schnee fallen um die Kamera, Licht und Sicht ändern sich.

**In Unity:** `Particle System + RenderSettings.fog`

**Eingaben:**

- `weather`: Optionen: klar, Regen, Schnee, Nebel
- `seconds`: number

#### setze Wind auf {speed} m/s Richtung {direction} °

`environment.setWind` · Form: Befehl · Seit Katalogversion 4

Stellt den Wind ein. Er lenkt Regen und Schnee ab. Die Richtung ist ein Kompasswinkel (0 = nach vorn, 90 = nach rechts).

**In Unity:** `WindZone`

**Eingaben:**

- `speed`: number
- `direction`: number

#### setze Nebeldichte auf {percent} %

`environment.setFogDensity` · Form: Befehl · Seit Katalogversion 4

Stellt die Dichte des Nebels ein: 0 ist kein Nebel, 100 ist sehr dicht.

**In Unity:** `RenderSettings.fogDensity`

**Eingaben:**

- `percent`: number

#### setze Sonnenhelligkeit auf {percent} %

`environment.setSunBrightness` · Form: Befehl · Seit Katalogversion 4

Dimmt oder verstärkt die Sonne (100 ist die Stärke aus der Szene).

**In Unity:** `Light.intensity`

**Eingaben:**

- `percent`: number

#### schalte Licht {target} {state}

`environment.setLight` · Form: Befehl · Seit Katalogversion 4

Schaltet die Licht-Komponente eines Objekts ein oder aus.

**In Unity:** `Light.enabled`

**Eingaben:**

- `target`: object, tag or asset (object)
- `state`: Optionen: ein, aus

#### setze Lichtfarbe von {target} auf {color}

`environment.setLightColor` · Form: Befehl · Seit Katalogversion 4

Ändert die Farbe der Licht-Komponente eines Objekts.

**In Unity:** `Light.color`

**Eingaben:**

- `target`: object, tag or asset (object)
- `color`: color

#### setze Grafikstufe auf {level}

`environment.setGraphicsLevel` · Form: Befehl · Seit Katalogversion 4

Wechselt die Grafikstufe, auch während das Spiel läuft (zum Beispiel aus einem Einstellungsmenü).

**In Unity:** `QualitySettings.SetQualityLevel`

**Eingaben:**

- `level`: Optionen: Niedrig, Mittel, Hoch, Ultra

## Gegenstände

#### Wenn ich {what}

`items.whenThing` · Form: Ereignis (Hut) · Seit Katalogversion 5

Startet das Skript, wenn mit dem Objekt etwas passiert: Spieler benutzt es, hebt es auf, öffnet oder schließt es (Pickup-, Tür-, Truhen- und Schalter-Komponenten).

**In Unity:** kein direktes Gegenstück (eine Blockwerk-Ergänzung)

**Eingaben:**

- `what`: Optionen: benutzt wird, aufgehoben wird, geöffnet wird, geschlossen wird, verschlossen ist, eingeschaltet wird, ausgeschaltet wird

#### Wenn ich {phase}

`items.whenHealth` · Form: Ereignis (Hut) · Seit Katalogversion 5

Startet das Skript, wenn das Objekt Schaden nimmt oder seine Lebenspunkte auf 0 fallen (Health-Komponente).

**In Unity:** kein direktes Gegenstück (eine Blockwerk-Ergänzung)

**Eingaben:**

- `phase`: Optionen: verletzt werde, sterbe

#### gib {count} × {item} an {target}

`items.add` · Form: Befehl · Seit Katalogversion 5

Legt Gegenstände ins Inventar eines Objekts (es bekommt eine Inventar-Komponente, falls es keine hat).

**In Unity:** `Inventory script (custom component)`

**Eingaben:**

- `count`: number
- `item`: text
- `target`: object, tag or asset (object)

#### nimm {count} × {item} von {target}

`items.remove` · Form: Befehl · Seit Katalogversion 5

Nimmt Gegenstände aus dem Inventar. Sind nicht genug da, passiert nichts.

**In Unity:** `Inventory script (custom component)`

**Eingaben:**

- `count`: number
- `item`: text
- `target`: object, tag or asset (object)

#### {target} hat {item}?

`items.has` · Form: Bedingung · Seit Katalogversion 5

Wahr, wenn das Objekt mindestens einen davon im Inventar hat.

**In Unity:** `Inventory script (custom component)`

**Eingaben:**

- `target`: object, tag or asset (object)
- `item`: text

#### Anzahl {item} bei {target}

`items.count` · Form: Wert · Seit Katalogversion 5

Wie viele dieser Gegenstände das Objekt im Inventar hat.

**In Unity:** `Inventory script (custom component)`

**Eingaben:**

- `item`: text
- `target`: object, tag or asset (object)

#### {action} {target}

`items.operate` · Form: Befehl · Seit Katalogversion 5

Öffnet, schließt oder wechselt eine Tür, ein Tor, eine Truhe oder einen Schalter. Der Block braucht keinen Schlüssel – die Bedingung baust du selbst davor.

**In Unity:** `Interactable script (custom component)`

**Eingaben:**

- `action`: Optionen: öffne, schließe, wechsle
- `target`: object, tag or asset (object)

#### hebe {target} auf

`items.pickUp` · Form: Befehl · Seit Katalogversion 5

Dieses Objekt hebt einen Aufheb-Gegenstand (Pickup-Komponente) auf: Er landet im Inventar und verschwindet aus der Szene.

**In Unity:** `Collectible script (custom component)`

**Eingaben:**

- `target`: object, tag or asset (object)

#### füge {target} {amount} Schaden zu

`items.damage` · Form: Befehl · Seit Katalogversion 5

Zieht dem Objekt Lebenspunkte ab. Fallen sie auf 0, stirbt es.

**In Unity:** `Health script (custom component)`

**Eingaben:**

- `amount`: number
- `target`: object, tag or asset (object)

#### heile {target} um {amount}

`items.heal` · Form: Befehl · Seit Katalogversion 5

Gibt dem Objekt Lebenspunkte zurück (höchstens bis zum Maximum).

**In Unity:** `Health script (custom component)`

**Eingaben:**

- `amount`: number
- `target`: object, tag or asset (object)

#### Leben von {target}

`items.health` · Form: Wert · Seit Katalogversion 5

Die Lebenspunkte des Objekts (0, wenn es keine Health-Komponente hat).

**In Unity:** `Health script (custom component)`

**Eingaben:**

- `target`: object, tag or asset (object)

## Effekte

#### erzeuge Effekt {effect} bei {at}

`effects.spawn` · Form: Befehl · Seit Katalogversion 4

Spielt einen Effekt an der Stelle eines Objekts ab. Staub, Funken, Explosion und Glitzer spielen einmal und verschwinden; Rauch, Feuer, Magie, Regen und Schnee laufen weiter.

**In Unity:** `Object.Instantiate of a Particle System prefab`

**Eingaben:**

- `effect`: Optionen: Staub, Funken, Explosion, Rauch, Feuer, Magie, Regen, Schnee, Glitzer
- `at`: object, tag or asset (object)

#### starte Partikelsystem {target}

`effects.start` · Form: Befehl · Seit Katalogversion 4

Startet das Partikelsystem eines Objekts (Unity: ParticleSystem.Play).

**In Unity:** `ParticleSystem.Play`

**Eingaben:**

- `target`: object, tag or asset (object)

#### stoppe Partikelsystem {target}

`effects.stop` · Form: Befehl · Seit Katalogversion 4

Stoppt das Partikelsystem eines Objekts. Teilchen, die schon fliegen, verblassen noch (Unity: ParticleSystem.Stop).

**In Unity:** `ParticleSystem.Stop`

**Eingaben:**

- `target`: object, tag or asset (object)

## UI

#### zeige UI {ui}

`ui.show` · Form: Befehl · Seit Katalogversion 6

Blendet eine UI-Leinwand ein, die auf „von Hand“ steht (zum Beispiel ein Einstellungsmenü). Die Leinwand muss in der Szene an einem Objekt mit der Komponente „UI-Leinwand“ hängen.

**In Unity:** `GameObject.SetActive on a Canvas`

**Eingaben:**

- `ui`: object, tag or asset (ui)

#### verstecke UI {ui}

`ui.hide` · Form: Befehl · Seit Katalogversion 6

Blendet eine UI-Leinwand wieder aus, die mit „zeige UI“ geöffnet wurde.

**In Unity:** `GameObject.SetActive on a Canvas`

**Eingaben:**

- `ui`: object, tag or asset (ui)

## Szenen und Speichern

#### lade Szene {scene} mit Ladebildschirm, Startpunkt {spawn}

`scenes.load` · Form: Befehl (beendet den Stapel) · Seit Katalogversion 5

Wechselt zu einer anderen Szene und zeigt dabei einen Ladebildschirm. Gegenstände, Leben und Spielvariablen des Spielers bleiben erhalten. Der Spieler erscheint am Objekt mit dem Tag „Spawn“ und diesem Namen (leer: am ersten).

**In Unity:** `SceneManager.LoadSceneAsync`

**Eingaben:**

- `scene`: object, tag or asset (scene)
- `spawn`: text

#### starte Szene neu

`scenes.restart` · Form: Befehl (beendet den Stapel) · Seit Katalogversion 5

Lädt die aktuelle Szene noch einmal mit Ladebildschirm; Spielstand der Szene geht verloren, Gegenstände und Variablen bleiben.

**In Unity:** `SceneManager.LoadScene(SceneManager.GetActiveScene().name)`

#### speichere Spiel in Platz {slot}

`saves.save` · Form: Befehl · Seit Katalogversion 6

Speichert die aktuelle Szene, alle Variablen, die als „wird gespeichert“ markiert sind, und Position, Inventar, Leben und Ausdauer der Spieler in einen von drei Plätzen. Gegner, Türen und Truhen werden nicht gespeichert.

**In Unity:** `PlayerPrefs / JSON file in Application.persistentDataPath`

**Eingaben:**

- `slot`: Optionen: 1, 2, 3

#### lade Spiel aus Platz {slot}

`saves.load` · Form: Befehl · Seit Katalogversion 6

Setzt das Spiel an der gespeicherten Stelle fort (mit Ladebildschirm). Ist der Platz leer, zeigt das Spiel einen Hinweis und nichts passiert.

**In Unity:** `PlayerPrefs / JSON file in Application.persistentDataPath`

**Eingaben:**

- `slot`: Optionen: 1, 2, 3

#### Platz {slot} ist belegt?

`saves.slotUsed` · Form: Bedingung · Seit Katalogversion 6

Wahr, wenn in diesem Platz ein Spielstand liegt (zum Beispiel für „Fortsetzen“ im Hauptmenü).

**In Unity:** `PlayerPrefs.HasKey / File.Exists`

**Eingaben:**

- `slot`: Optionen: 1, 2, 3

## Listen und Wörterbücher

#### neue leere Liste

`data.newList` · Form: Wert · Seit Katalogversion 7

Eine neue Liste ohne Einträge. Zum Beispiel in eine Variable setzen.

**In Unity:** `new List<T>()`

#### neues leeres Wörterbuch

`data.newDictionary` · Form: Wert · Seit Katalogversion 7

Ein neues Wörterbuch ohne Einträge. Jeder Eintrag hat einen Schlüssel (Text) und einen Wert.

**In Unity:** `new Dictionary<K, V>()`

#### teile {text} bei {separator}

`data.split` · Form: Wert · Seit Katalogversion 7

Zerlegt einen Text an jedem Trennzeichen in eine Liste.

**In Unity:** `string.Split`

**Eingaben:**

- `text`: text
- `separator`: text

#### füge {item} zu {list} hinzu

`data.listAdd` · Form: Befehl · Seit Katalogversion 7

Hängt einen Eintrag ans Ende der Liste.

**In Unity:** `List.Add`

**Eingaben:**

- `item`: any value
- `list`: any value

#### füge {item} an Stelle {index} in {list} ein

`data.listInsert` · Form: Befehl · Seit Katalogversion 7

Fügt einen Eintrag an der Stelle ein (1 ist der erste). Die folgenden rücken nach hinten.

**In Unity:** `List.Insert`

**Eingaben:**

- `item`: any value
- `index`: number
- `list`: any value

#### lösche Eintrag {index} aus {list}

`data.listRemoveAt` · Form: Befehl · Seit Katalogversion 7

Löscht den Eintrag an der Stelle (1 ist der erste).

**In Unity:** `List.RemoveAt`

**Eingaben:**

- `index`: number
- `list`: any value

#### ersetze Eintrag {index} von {list} durch {item}

`data.listSet` · Form: Befehl · Seit Katalogversion 7

Ersetzt den Eintrag an der Stelle (1 ist der erste).

**In Unity:** `list[index] = item`

**Eingaben:**

- `index`: number
- `list`: any value
- `item`: any value

#### lösche alle Einträge von {list}

`data.listClear` · Form: Befehl · Seit Katalogversion 7

Leert die Liste.

**In Unity:** `List.Clear`

**Eingaben:**

- `list`: any value

#### Eintrag {index} von {list}

`data.listGet` · Form: Wert · Seit Katalogversion 7

Der Eintrag an der Stelle (1 ist der erste). Gibt es ihn nicht, ist das Ergebnis leer.

**In Unity:** `list[index]`

**Eingaben:**

- `index`: number
- `list`: any value

#### Länge von {list}

`data.listLength` · Form: Wert · Seit Katalogversion 7

Wie viele Einträge die Liste hat.

**In Unity:** `List.Count`

**Eingaben:**

- `list`: any value

#### {list} enthält {item}?

`data.listContains` · Form: Bedingung · Seit Katalogversion 7

Wahr, wenn der Eintrag in der Liste vorkommt (Groß- und Kleinschreibung egal).

**In Unity:** `List.Contains`

**Eingaben:**

- `list`: any value
- `item`: any value

#### Stelle von {item} in {list}

`data.listIndexOf` · Form: Wert · Seit Katalogversion 7

Die Stelle des ersten Treffers (1 ist die erste), 0 wenn der Eintrag fehlt.

**In Unity:** `List.IndexOf`

**Eingaben:**

- `item`: any value
- `list`: any value

#### verbinde {list} mit {separator}

`data.listJoin` · Form: Wert · Seit Katalogversion 7

Macht aus den Einträgen einen Text, getrennt durch das Trennzeichen.

**In Unity:** `string.Join`

**Eingaben:**

- `list`: any value
- `separator`: text

#### setze {key} in {dictionary} auf {value}

`data.dictSet` · Form: Befehl · Seit Katalogversion 7

Legt den Eintrag mit diesem Schlüssel an oder überschreibt ihn.

**In Unity:** `dictionary[key] = value`

**Eingaben:**

- `key`: text
- `dictionary`: any value
- `value`: any value

#### lösche {key} aus {dictionary}

`data.dictRemove` · Form: Befehl · Seit Katalogversion 7

Löscht den Eintrag mit diesem Schlüssel.

**In Unity:** `Dictionary.Remove`

**Eingaben:**

- `key`: text
- `dictionary`: any value

#### {key} aus {dictionary}

`data.dictGet` · Form: Wert · Seit Katalogversion 7

Der Wert zu diesem Schlüssel. Gibt es ihn nicht, ist das Ergebnis leer.

**In Unity:** `dictionary[key]`

**Eingaben:**

- `key`: text
- `dictionary`: any value

#### {dictionary} hat {key}?

`data.dictHas` · Form: Bedingung · Seit Katalogversion 7

Wahr, wenn es den Schlüssel gibt.

**In Unity:** `Dictionary.ContainsKey`

**Eingaben:**

- `dictionary`: any value
- `key`: text

#### Schlüssel von {dictionary}

`data.dictKeys` · Form: Wert · Seit Katalogversion 7

Eine Liste mit allen Schlüsseln, in der Reihenfolge des Anlegens.

**In Unity:** `Dictionary.Keys`

**Eingaben:**

- `dictionary`: any value

#### Anzahl Einträge in {dictionary}

`data.dictSize` · Form: Wert · Seit Katalogversion 7

Wie viele Einträge das Wörterbuch hat.

**In Unity:** `Dictionary.Count`

**Eingaben:**

- `dictionary`: any value

#### für jeden {name} in {list}

`data.forEachItem` · Form: C-förmiger Befehl · Seit Katalogversion 7

Geht die Einträge einer Liste der Reihe nach durch. Den aktuellen Eintrag liefert der Block „lokale Variable“ mit dem eingestellten Namen. Bei einem Wörterbuch geht es die Schlüssel durch.

**In Unity:** `foreach`

**Eingaben:**

- `name`: text
- `list`: any value
- `body`: blocks

## Code

#### Code {code}

`code.run` · Form: Befehl · Seit Katalogversion 7

JavaScript für Fortgeschrittene. Verfügbar sind self (dieses Objekt), game (die Spiel-Funktionen der Blöcke), scene (Objekte suchen) und three (die 3D-Bibliothek). Mit yield* game.wait(1) lässt sich warten. Der Code wird nie automatisch umgeschrieben.

**In Unity:** `the body of a C# method`

**Eingaben:**

- `code`: text

#### Code-Wert {code}

`code.value` · Form: Wert · Seit Katalogversion 7

Ein JavaScript-Ausdruck als Wert, zum Beispiel self.position.y. Verfügbar sind self, game, scene und three.

**In Unity:** `a C# expression`

**Eingaben:**

- `code`: text

## Meine Blöcke

#### Befehl {name}

`custom.defineCommand` · Form: Ereignis (Hut) · Seit Katalogversion 7

Definiert einen eigenen Befehlsblock. Was darunter hängt, läuft, wenn der Block benutzt wird.

**In Unity:** `a method (void)`

**Eingaben:**

- `name`: text

#### Wert {name}

`custom.defineValue` · Form: Ereignis (Hut) · Seit Katalogversion 7

Definiert einen eigenen Wertblock. Mit „gib zurück“ legst du das Ergebnis fest.

**In Unity:** `a method that returns a value`

**Eingaben:**

- `name`: text

#### Bedingung {name}

`custom.defineCondition` · Form: Ereignis (Hut) · Seit Katalogversion 7

Definiert eine eigene Bedingung. Mit „gib zurück“ legst du fest, ob sie wahr ist.

**In Unity:** `a method that returns bool`

**Eingaben:**

- `name`: text

#### gib {value} zurück

`custom.return` · Form: Befehl (beendet den Stapel) · Seit Katalogversion 7

Beendet den eigenen Block sofort. In einem Wert- oder Bedingungsblock ist der Eintrag das Ergebnis.

**In Unity:** `return`

**Eingaben:**

- `value`: any value

#### Eingabe {name}

`custom.param` · Form: Wert · Seit Katalogversion 7

Der Wert einer Eingabe des eigenen Blocks, in dem dieser Block liegt.

**In Unity:** `a method parameter`

**Eingaben:**

- `name`: text

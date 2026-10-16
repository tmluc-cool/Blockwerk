# Blocks

Generated from the block catalog and the component definitions. Do not edit by hand.

## Events

#### when game starts

`events.whenGameStarts` · Shape: event (hat) · Since catalog version 1

Runs the script once when the game starts (Unity: Start).

**In Unity:** `MonoBehaviour.Start`

#### every frame

`events.everyFrame` · Shape: event (hat) · Since catalog version 1

Runs the script every frame (60 times per second) unless it is still running (Unity: Update).

**In Unity:** `MonoBehaviour.Update`

#### when {key} key {mode}

`events.whenKey` · Shape: event (hat) · Since catalog version 1

Runs the script when the key goes down, while it is held, or when it is released.

**In Unity:** `Input.GetKeyDown / GetKey / GetKeyUp`

**Inputs:**

- `key`: options: space, up arrow, down arrow, left arrow, right arrow, any, A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, P, Q, R, S, T, U, V, W, X, Y, Z, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, enter, shift
- `mode`: options: pressed, held, released

#### when this object clicked

`events.whenClicked` · Shape: event (hat) · Since catalog version 1

Runs the script when the object is clicked in the game view.

**In Unity:** `MonoBehaviour.OnMouseDown`

#### when I {phase} {target}

`events.whenTouching` · Shape: event (hat) · Since catalog version 1

Runs the script when this object's colliders touch an object or an object with the tag (Unity: OnTriggerEnter/Stay/Exit).

**In Unity:** `OnCollisionEnter/Stay/Exit, OnTriggerEnter/Stay/Exit`

**Inputs:**

- `target`: object, tag or asset (touchTarget)
- `phase`: options: start touching, touch, stop touching

#### when {target} {phase} this zone

`events.whenZone` · Shape: event (hat) · Since catalog version 3

Runs the script on an object whose Collider has "Is Trigger" when an object or an object with the tag enters or leaves the zone (Unity: OnTriggerEnter/Exit).

**In Unity:** `OnTriggerEnter/Stay/Exit on a trigger collider`

**Inputs:**

- `target`: object, tag or asset (touchTarget)
- `phase`: options: enters, leaves

#### when action {action} {phase} for {player}

`events.whenAction` · Shape: event (hat) · Since catalog version 3

Runs the script when a player’s input action is triggered. Works with keyboard, mouse and gamepad (Unity: Input Actions).

**In Unity:** `InputAction.performed (Input System)`

**Inputs:**

- `action`: options: Jump, Sprint, Crouch, Interact, Attack, Pause
- `phase`: options: pressed, held, released
- `player`: options: any player, player 1, player 2

#### when animation {animation} {phase}

`events.whenAnimation` · Shape: event (hat) · Since catalog version 3

Runs the script when an animation started with "play animation" begins or ends. The name is a standard state (for example wave) or a clip name.

**In Unity:** `Animation Event / StateMachineBehaviour`

**Inputs:**

- `animation`: text
- `phase`: options: finished, started

#### when I {ability}: {phase}

`events.whenAbility` · Shape: event (hat) · Since catalog version 3

Runs the script when the character uses an ability (roll, glide, double jump) or stops using it.

**In Unity:** no direct counterpart (a Blockwerk addition)

**Inputs:**

- `ability`: options: roll, glide, double jump
- `phase`: options: start, stop

#### when I receive message {message}

`events.whenMessage` · Shape: event (hat) · Since catalog version 5

Runs the script when this message is sent to the object (block "send message", also from switches and chests). Delivery happens at the start of the next tick.

**In Unity:** `SendMessage / UnityEvent`

**Inputs:**

- `message`: text

#### when timer {name} runs out

`events.whenTimer` · Shape: event (hat) · Since catalog version 5

Runs the script when a timer of this object started with "start timer" has run out.

**In Unity:** `Invoke / Coroutine with WaitForSeconds`

**Inputs:**

- `name`: text

#### when I am created

`events.whenCreated` · Shape: event (hat) · Since catalog version 1

Runs the script in a newly created clone of this object.

**In Unity:** `MonoBehaviour.Awake`

#### when I am destroyed

`events.whenDestroyed` · Shape: event (hat) · Since catalog version 1

Runs right before the object is destroyed (Unity: OnDestroy).

**In Unity:** `MonoBehaviour.OnDestroy`

## Motion

#### move {meters} m {direction}

`motion.move` · Shape: command · Since catalog version 1

Moves the object along its facing direction, sideways, or up and down.

**In Unity:** `Transform.Translate`

**Inputs:**

- `meters`: number
- `direction`: options: forward, backward, left, right, up, down

#### turn {direction} {degrees} degrees

`motion.turn` · Shape: command · Since catalog version 1

Turns the object left, right, up or down.

**In Unity:** `Transform.Rotate`

**Inputs:**

- `degrees`: number
- `direction`: options: right, left, up, down

#### go to x: {x} y: {y} z: {z}

`motion.goToXYZ` · Shape: command · Since catalog version 1

Sets the position (in meters).

**In Unity:** `Transform.position`

**Inputs:**

- `x`: number
- `y`: number
- `z`: number

#### go to {target}

`motion.goToObject` · Shape: command · Since catalog version 1

Jumps to the position of an object or the mouse pointer.

**In Unity:** `Transform.position = other.position`

**Inputs:**

- `target`: object, tag or asset (objectOrMouse)

#### glide {seconds} s to {target} {easing}

`motion.glideToObject` · Shape: command · Since catalog version 1

Moves the object to an object or the mouse pointer in the given time.

**In Unity:** `Vector3.Lerp / LeanTween.move`

**Inputs:**

- `seconds`: number
- `target`: object, tag or asset (objectOrMouse)
- `easing`: options: smooth, linear, springy

#### glide {seconds} s to x: {x} y: {y} z: {z} {easing}

`motion.glideToXYZ` · Shape: command · Since catalog version 1

Moves the object to a position in the given time.

**In Unity:** `Vector3.Lerp / LeanTween.move`

**Inputs:**

- `seconds`: number
- `x`: number
- `y`: number
- `z`: number
- `easing`: options: smooth, linear, springy

#### look at {target}

`motion.lookAt` · Shape: command · Since catalog version 1

Turns the object horizontally towards an object or the mouse pointer.

**In Unity:** `Transform.LookAt`

**Inputs:**

- `target`: object, tag or asset (objectOrMouse)

#### set rotation to x: {x} y: {y} z: {z}

`motion.setRotation` · Shape: command · Since catalog version 1

Sets the rotation in degrees (as in the inspector).

**In Unity:** `Transform.eulerAngles`

**Inputs:**

- `x`: number
- `y`: number
- `z`: number

#### set scale to x: {x} y: {y} z: {z}

`motion.setScale` · Shape: command · Since catalog version 1

Sets the scale (as in the inspector).

**In Unity:** `Transform.localScale`

**Inputs:**

- `x`: number
- `y`: number
- `z`: number

#### {axis} position

`motion.position` · Shape: value · Since catalog version 1

The object's position in the world (meters).

**In Unity:** `Transform.position`

**Inputs:**

- `axis`: options: x, y, z

#### heading

`motion.heading` · Shape: value · Since catalog version 1

Heading in degrees: 0 faces +Z, 90 faces +X.

**In Unity:** `Transform.eulerAngles.y`

#### {property} of {target}

`motion.propertyOf` · Shape: value · Since catalog version 1

A property of another object.

**In Unity:** `GetComponent<Transform>()`

**Inputs:**

- `property`: options: x position, y position, z position, heading, size
- `target`: object, tag or asset (object)

## Looks

#### play animation {name} {mode} with fade {fade} s

`looks.playAnimation` · Shape: command · Since catalog version 3

Plays an animation of the model. The name is a standard state (wave, cheer, attack, hit, death, interact …) or a clip name. Afterwards the controller takes over again.

**In Unity:** `Animator.CrossFade`

**Inputs:**

- `name`: text
- `mode`: options: once, looping
- `fade`: number

#### set color to {color}

`looks.setColor` · Shape: command · Since catalog version 1

Changes the material color of the mesh renderer.

**In Unity:** `Renderer.material.color`

**Inputs:**

- `color`: color

#### show

`looks.show` · Shape: command · Since catalog version 1

Makes the object visible.

**In Unity:** `Renderer.enabled = true`

#### hide

`looks.hide` · Shape: command · Since catalog version 1

Makes the object invisible. Invisible objects touch nothing.

**In Unity:** `Renderer.enabled = false`

#### set size to {percent} %

`looks.setSize` · Shape: command · Since catalog version 1

Sets the size in percent of the scale from the scene.

**In Unity:** `Transform.localScale`

**Inputs:**

- `percent`: number

#### {action} {target}

`looks.setActive` · Shape: command · Since catalog version 1

Activates or deactivates an object and its children (Unity: SetActive). Inactive objects are invisible and their scripts pause.

**In Unity:** `GameObject.SetActive`

**Inputs:**

- `action`: options: activate, deactivate
- `target`: object, tag or asset (object)

## Sound

#### play sound {sound} {where}

`sound.play` · Shape: command · Since catalog version 4

Plays a sound once. "here" is a 3D sound at the object’s position: quieter with distance, from the right direction. "everywhere" sounds equally loud wherever you are.

**In Unity:** `AudioSource.PlayOneShot`

**Inputs:**

- `sound`: object, tag or asset (sound)
- `where`: options: here, everywhere

#### play music {sound} on loop

`sound.playMusic` · Shape: command · Since catalog version 4

Plays music on an endless loop. If other music is playing, it fades over.

**In Unity:** `AudioSource.Play with loop = true`

**Inputs:**

- `sound`: object, tag or asset (sound)

#### fade music over to {sound} in {seconds} s

`sound.crossfadeMusic` · Shape: command · Since catalog version 4

Slowly fades out the music that plays while fading in the new piece.

**In Unity:** `AudioMixer snapshot transition`

**Inputs:**

- `sound`: object, tag or asset (sound)
- `seconds`: number

#### stop all sounds

`sound.stopAll` · Shape: command · Since catalog version 4

Stops all sounds and the music.

**In Unity:** `AudioSource.Stop`

#### set volume {channel} to {percent} %

`sound.setVolume` · Shape: command · Since catalog version 4

Sets the volume of a channel: music, effects or voices (0 to 100 %).

**In Unity:** `AudioMixer.SetFloat`

**Inputs:**

- `channel`: options: music, effects, voices
- `percent`: number

## Control

#### wait {seconds} s

`control.wait` · Shape: command · Since catalog version 1

Waits for the given time.

**In Unity:** `yield return new WaitForSeconds`

**Inputs:**

- `seconds`: number

#### forever

`control.forever` · Shape: C-shaped command · Since catalog version 1

Runs the body again and again, once per frame.

**In Unity:** `while (true) { ... yield return null; }`

**Inputs:**

- `body`: blocks

#### repeat {times}

`control.repeat` · Shape: C-shaped command · Since catalog version 1

Runs the body that many times. Each pass ends with the next frame.

**In Unity:** `for loop`

**Inputs:**

- `times`: number
- `body`: blocks

#### repeat until {condition}

`control.repeatUntil` · Shape: C-shaped command · Since catalog version 1

Runs the body until the condition is true.

**In Unity:** `while loop`

**Inputs:**

- `condition`: true/false
- `body`: blocks

#### if {condition} then

`control.if` · Shape: C-shaped command · Since catalog version 1

Runs the body only if the condition is true.

**In Unity:** `if`

**Inputs:**

- `condition`: true/false
- `then`: blocks

#### if {condition} then

`control.ifElse` · Shape: C-shaped command · Since catalog version 1

Runs the upper part if the condition is true, otherwise the lower part.

**In Unity:** `if / else`

**Inputs:**

- `condition`: true/false
- `then`: blocks
- `else`: blocks

#### wait until {condition}

`control.waitUntil` · Shape: command · Since catalog version 1

Waits until the condition is true (checked every frame).

**In Unity:** `yield return new WaitUntil`

**Inputs:**

- `condition`: true/false

#### create clone of {target}

`control.clone` · Shape: command · Since catalog version 1

Creates a copy of the object at its place (Unity: Instantiate). "When I am created" runs in the copy.

**In Unity:** `Object.Instantiate`

**Inputs:**

- `target`: object, tag or asset (object)

#### create {prefab} at {at}

`control.spawnPrefab` · Shape: command · Since catalog version 1

Creates an instance of a prefab at an object's position (Unity: Instantiate with a prefab). "When I am created" runs in the new object.

**In Unity:** `Object.Instantiate(prefab, position, rotation)`

**Inputs:**

- `prefab`: object, tag or asset (prefab)
- `at`: object, tag or asset (object)

#### destroy {target}

`control.destroy` · Shape: command · Since catalog version 1

Removes an object from the game (Unity: Destroy). If it destroys itself, the script ends.

**In Unity:** `Object.Destroy`

**Inputs:**

- `target`: object, tag or asset (object)

#### stop {what}

`control.stop` · Shape: command (ends the stack) · Since catalog version 1

Ends this script or all scripts of the game.

**In Unity:** `StopCoroutine / StopAllCoroutines`

**Inputs:**

- `what`: options: this script, all

#### write to log {level} {message}

`control.log` · Shape: command · Since catalog version 8

Writes the value to the console. Clicking the entry jumps to this block. "Warning" and "error" can be filtered in the console.

**In Unity:** `Debug.Log / LogWarning / LogError`

**Inputs:**

- `level`: options: info, warning, error
- `message`: any value

#### send message {message} to {target}

`control.sendMessage` · Shape: command · Since catalog version 5

Sends a message to one object, to all objects with a tag, or to everyone. Receivers are scripts with "when I receive message …". Delivery happens at the start of the next tick.

**In Unity:** `GameObject.SendMessage / UnityEvent.Invoke`

**Inputs:**

- `message`: text
- `target`: object, tag or asset (messageTarget)

#### start timer {name} for {seconds} s

`control.startTimer` · Shape: command · Since catalog version 5

Starts a timer of this object. The script goes on right away; when the time is up, "when timer … runs out" starts. The same name restarts the timer.

**In Unity:** `Invoke / Coroutine`

**Inputs:**

- `name`: text
- `seconds`: number

#### for each object in {target}

`control.forEachObject` · Shape: C-shaped command · Since catalog version 5

Runs the body for every object with the tag (or for everyone). Inside the body, "loop object" in the object choices names the current one. All passes run in the same frame unless the body waits.

**In Unity:** `foreach over FindGameObjectsWithTag`

**Inputs:**

- `target`: object, tag or asset (touchTarget)
- `body`: blocks

## Sensing

#### key {key} pressed?

`sensing.keyPressed` · Shape: condition · Since catalog version 1

True while the key is held down.

**In Unity:** `Input.GetKey`

**Inputs:**

- `key`: options: space, up arrow, down arrow, left arrow, right arrow, any, A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, P, Q, R, S, T, U, V, W, X, Y, Z, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, enter, shift

#### touching {target}?

`sensing.touching` · Shape: condition · Since catalog version 1

True if this object's colliders touch the object or an object with the tag.

**In Unity:** `Collider.bounds.Intersects / OnCollisionStay`

**Inputs:**

- `target`: object, tag or asset (touchTarget)

#### distance to {target}

`sensing.distanceTo` · Shape: value · Since catalog version 1

Distance in meters.

**In Unity:** `Vector3.Distance`

**Inputs:**

- `target`: object, tag or asset (objectOrMouse)

#### mouse x

`sensing.mouseX` · Shape: value · Since catalog version 1

Horizontal mouse position in the game view, in pixels from the center (right is positive).

**In Unity:** `Input.mousePosition.x`

#### mouse y

`sensing.mouseY` · Shape: value · Since catalog version 1

Vertical mouse position in the game view, in pixels from the center (up is positive).

**In Unity:** `Input.mousePosition.y`

#### mouse down?

`sensing.mouseDown` · Shape: condition · Since catalog version 1

True while the mouse button is held.

**In Unity:** `Input.GetMouseButton`

#### timer

`sensing.timer` · Shape: value · Since catalog version 1

Seconds since the game started or since the last reset.

**In Unity:** `Time.time`

#### reset timer

`sensing.resetTimer` · Shape: command · Since catalog version 1

Sets the timer to 0.

**In Unity:** no direct counterpart (a Blockwerk addition)

#### pick random {from} to {to}

`sensing.random` · Shape: value · Since catalog version 1

A random number. If both limits are whole numbers, so is the result.

**In Unity:** `Random.Range`

**Inputs:**

- `from`: number
- `to`: number

## Operators

#### {a} + {b}

`operators.add` · Shape: value · Since catalog version 1

Sum of two numbers.

**In Unity:** `+`

**Inputs:**

- `a`: number
- `b`: number

#### {a} − {b}

`operators.subtract` · Shape: value · Since catalog version 1

Difference of two numbers.

**In Unity:** `-`

**Inputs:**

- `a`: number
- `b`: number

#### {a} × {b}

`operators.multiply` · Shape: value · Since catalog version 1

Product of two numbers.

**In Unity:** `*`

**Inputs:**

- `a`: number
- `b`: number

#### {a} ÷ {b}

`operators.divide` · Shape: value · Since catalog version 1

Quotient of two numbers.

**In Unity:** `/`

**Inputs:**

- `a`: number
- `b`: number

#### {a} mod {b}

`operators.mod` · Shape: value · Since catalog version 1

Remainder of the division, always with the sign of the divisor (as in Scratch).

**In Unity:** `%`

**Inputs:**

- `a`: number
- `b`: number

#### round {value}

`operators.round` · Shape: value · Since catalog version 1

Rounds to the nearest whole number.

**In Unity:** `Mathf.Round`

**Inputs:**

- `value`: number

#### {fn} of {value}

`operators.mathFunction` · Shape: value · Since catalog version 1

Mathematical function. Angles in degrees.

**In Unity:** `Mathf.Abs, Floor, Ceil, Sqrt, Sin, Cos`

**Inputs:**

- `fn`: options: abs, floor, ceiling, sqrt, sin, cos, tan, ln, e ^
- `value`: number

#### min of {a} and {b}

`operators.min` · Shape: value · Since catalog version 1

The smaller of the two numbers.

**In Unity:** `Mathf.Min`

**Inputs:**

- `a`: number
- `b`: number

#### max of {a} and {b}

`operators.max` · Shape: value · Since catalog version 1

The larger of the two numbers.

**In Unity:** `Mathf.Max`

**Inputs:**

- `a`: number
- `b`: number

#### clamp {value} between {low} and {high}

`operators.clamp` · Shape: value · Since catalog version 1

Keeps a number between two limits.

**In Unity:** `Mathf.Clamp`

**Inputs:**

- `value`: number
- `low`: number
- `high`: number

#### lerp from {a} to {b} by {t}

`operators.lerp` · Shape: value · Since catalog version 1

Value between two numbers: 0 gives the first, 1 the second (Unity: Mathf.LerpUnclamped).

**In Unity:** `Mathf.Lerp`

**Inputs:**

- `a`: number
- `b`: number
- `t`: number

#### {a} < {b}

`operators.lt` · Shape: condition · Since catalog version 1

True if the left value is smaller.

**In Unity:** `<`

**Inputs:**

- `a`: any value
- `b`: any value

#### {a} = {b}

`operators.eq` · Shape: condition · Since catalog version 1

True if both values are equal (text ignores upper/lower case).

**In Unity:** `==`

**Inputs:**

- `a`: any value
- `b`: any value

#### {a} > {b}

`operators.gt` · Shape: condition · Since catalog version 1

True if the left value is larger.

**In Unity:** `>`

**Inputs:**

- `a`: any value
- `b`: any value

#### {a} and {b}

`operators.and` · Shape: condition · Since catalog version 1

True if both conditions are true.

**In Unity:** `&&`

**Inputs:**

- `a`: true/false
- `b`: true/false

#### {a} or {b}

`operators.or` · Shape: condition · Since catalog version 1

True if at least one condition is true.

**In Unity:** `||`

**Inputs:**

- `a`: true/false
- `b`: true/false

#### not {value}

`operators.not` · Shape: condition · Since catalog version 1

Inverts a condition.

**In Unity:** `!`

**Inputs:**

- `value`: true/false

#### join {a} {b}

`operators.join` · Shape: value · Since catalog version 1

Joins two texts.

**In Unity:** `string concatenation (+)`

**Inputs:**

- `a`: text
- `b`: text

#### length of {text}

`operators.length` · Shape: value · Since catalog version 1

Number of characters of a text.

**In Unity:** `string.Length`

**Inputs:**

- `text`: text

#### letter {index} of {text}

`operators.letterOf` · Shape: value · Since catalog version 1

One character of a text, counted from 1.

**In Unity:** `string[index]`

**Inputs:**

- `index`: number
- `text`: text

#### {text} contains {part}?

`operators.contains` · Shape: condition · Since catalog version 1

True if the text contains the part (ignoring upper/lower case).

**In Unity:** `string.Contains`

**Inputs:**

- `text`: text
- `part`: text

## Variables

#### {variable}

`variables.get` · Shape: value · Since catalog version 1

The value of the variable.

**In Unity:** `a field of the MonoBehaviour, or a static field`

**Inputs:**

- `variable`: variable

#### set {variable} to {value}

`variables.set` · Shape: command · Since catalog version 1

Gives the variable a new value.

**In Unity:** `assignment to a field`

**Inputs:**

- `variable`: variable
- `value`: any value

#### change {variable} by {by}

`variables.change` · Shape: command · Since catalog version 1

Adds a number to the variable (negative numbers subtract).

**In Unity:** `compound assignment (+=)`

**Inputs:**

- `variable`: variable
- `by`: number

#### show variable {variable}

`variables.show` · Shape: command · Since catalog version 1

Shows the value of the variable in the game view.

**In Unity:** no direct counterpart (a Blockwerk addition)

**Inputs:**

- `variable`: variable

#### hide variable {variable}

`variables.hide` · Shape: command · Since catalog version 1

Hides the display of the variable again.

**In Unity:** no direct counterpart (a Blockwerk addition)

**Inputs:**

- `variable`: variable

#### local variable {name} = {value}

`locals.declare` · Shape: command · Since catalog version 7

Creates a variable that only exists in this stack and in everything below and inside it.

**In Unity:** `local variable declaration`

**Inputs:**

- `name`: text
- `value`: any value

#### set local {name} to {value}

`locals.set` · Shape: command · Since catalog version 7

Gives a local variable a new value.

**In Unity:** `assignment to a local variable`

**Inputs:**

- `name`: text
- `value`: any value

#### change local {name} by {by}

`locals.change` · Shape: command · Since catalog version 7

Adds a number to the local variable.

**In Unity:** `compound assignment (+=)`

**Inputs:**

- `name`: text
- `by`: number

#### local {name}

`locals.get` · Shape: value · Since catalog version 7

The value of the local variable.

**In Unity:** `local variable`

**Inputs:**

- `name`: text

## Player

#### set {setting} to {value}

`player.setValue` · Shape: command · Since catalog version 3

Changes a value of this object’s controller (meters per second, or meters).

**In Unity:** `fields of the CharacterController / player script`

**Inputs:**

- `setting`: options: walk speed, run speed, jump height
- `value`: number

#### jump

`player.jump` · Shape: command · Since catalog version 3

Makes the character jump as if the jump button was pressed (with jump buffer and coyote time).

**In Unity:** `CharacterController.Move with a jump velocity`

#### crouch

`player.crouch` · Shape: command · Since catalog version 3

Crouches the character until "stand up" follows.

**In Unity:** `CharacterController.height`

#### stand up

`player.standUp` · Shape: command · Since catalog version 3

Stands the character up as soon as there is room above.

**In Unity:** `CharacterController.height`

#### {state} controls

`player.lockControls` · Shape: command · Since catalog version 3

Locks the character's input (for example in a cutscene) or releases it.

**In Unity:** `MonoBehaviour.enabled = false`

**Inputs:**

- `state`: options: lock, unlock

#### teleport me to {target}

`player.teleport` · Shape: command · Since catalog version 3

Puts the character at the position of an object (for example a checkpoint) and stops its movement.

**In Unity:** `CharacterController.enabled + Transform.position`

**Inputs:**

- `target`: object, tag or asset (object)

#### on the ground?

`player.onGround` · Shape: condition · Since catalog version 3

True while the character stands on the ground.

**In Unity:** `CharacterController.isGrounded`

#### running?

`player.isRunning` · Shape: condition · Since catalog version 3

True while the character is sprinting.

**In Unity:** no direct counterpart (a Blockwerk addition)

#### speed

`player.speed` · Shape: value · Since catalog version 3

Horizontal speed of the character in meters per second.

**In Unity:** `CharacterController.velocity.magnitude`

## Camera

#### switch camera to {view}

`camera.switchTo` · Shape: command · Since catalog version 3

Switches to the camera with this behavior, with a smooth transition. The other cameras of the player are turned off.

**In Unity:** `Cinemachine: change the Priority of a virtual camera`

**Inputs:**

- `view`: options: third person, first person, top down, side view, fixed camera, shared camera

#### switch camera to camera of {target}

`camera.switchToObject` · Shape: command · Since catalog version 3

Switches to the camera of another object, with a smooth transition.

**In Unity:** `Cinemachine: change the Priority of a virtual camera`

**Inputs:**

- `target`: object, tag or asset (object)

#### set camera distance to {distance}

`camera.setDistance` · Shape: command · Since catalog version 3

Changes the distance of the camera to its target (in meters).

**In Unity:** `CinemachineFramingTransposer.m_CameraDistance`

**Inputs:**

- `distance`: number

#### shake camera strength {strength} for {seconds} s

`camera.shake` · Shape: command · Since catalog version 3

Shakes the camera briefly. The strength is an angle in degrees and fades out until the end.

**In Unity:** `Cinemachine Impulse Source`

**Inputs:**

- `strength`: number
- `seconds`: number

#### play camera path {target}

`camera.playPath` · Shape: command · Since catalog version 3

Switches to the object with the Camera Path component and plays it from the start.

**In Unity:** `Cinemachine Dolly Cart`

**Inputs:**

- `target`: object, tag or asset (object)

#### set field of view to {fov} in {seconds} s

`camera.setFieldOfView` · Shape: command · Since catalog version 3

Changes the camera's field of view (in degrees) smoothly over the given time.

**In Unity:** `Camera.fieldOfView`

**Inputs:**

- `fov`: number
- `seconds`: number

## Character

#### attach {item} to {point}

`character.attach` · Shape: command · Since catalog version 3

Attaches an item (a model, for example from the library) to an attachment point of the character. Whatever hung there is replaced.

**In Unity:** `Transform.SetParent on a bone`

**Inputs:**

- `item`: text
- `point`: options: right hand, left hand, back, head, hip

#### put away what hangs on {point}

`character.detach` · Shape: command · Since catalog version 3

Takes off the item that hangs on this attachment point.

**In Unity:** `Transform.SetParent(null)`

**Inputs:**

- `point`: options: right hand, left hand, back, head, hip

#### switch part {from} to {to}

`character.switchPart` · Shape: command · Since catalog version 3

Hides one part of the model and shows another instead (the part names are listed in the Character Studio).

**In Unity:** no direct counterpart (a Blockwerk addition)

**Inputs:**

- `from`: text
- `to`: text

#### set color of part {part} to {color}

`character.setPartColor` · Shape: command · Since catalog version 3

Tints one part of the model (for example for player 2).

**In Unity:** `Renderer.material.color`

**Inputs:**

- `part`: text
- `color`: color

#### switch movement profile to {profile}

`character.setProfile` · Shape: command · Since catalog version 3

Sets the character's speed, jump, acceleration and gravity to the values of the profile.

**In Unity:** no direct counterpart (a Blockwerk addition)

**Inputs:**

- `profile`: options: arcade, realistic, agile, heavy, floating

#### {state} ability {ability}

`character.setAbility` · Shape: command · Since catalog version 3

Turns an ability of the character on or off (it has to be a component on the character).

**In Unity:** no direct counterpart (a Blockwerk addition)

**Inputs:**

- `state`: options: enable, disable
- `ability`: options: double jump, roll, glide, stamina

#### do I have ability {ability}?

`character.hasAbility` · Shape: condition · Since catalog version 3

True if the character has the ability and it is turned on.

**In Unity:** no direct counterpart (a Blockwerk addition)

**Inputs:**

- `ability`: options: double jump, roll, glide, stamina

#### set stamina to {percent} %

`character.setStamina` · Shape: command · Since catalog version 3

Sets the character's stamina to a percentage (0 to 100).

**In Unity:** no direct counterpart (a Blockwerk addition)

**Inputs:**

- `percent`: number

#### stamina in %

`character.stamina` · Shape: value · Since catalog version 3

The character's stamina in percent (100 without the stamina ability).

**In Unity:** no direct counterpart (a Blockwerk addition)

## Physics

#### push me with force {force} {direction}

`physics.push` · Shape: command · Since catalog version 3

Gives the object a push (impulse) along its facing direction or sideways. Needs a Rigidbody.

**In Unity:** `Rigidbody.AddForce`

**Inputs:**

- `force`: number
- `direction`: options: forward, backward, left, right, up, down

#### set velocity to x: {x} y: {y} z: {z}

`physics.setVelocity` · Shape: command · Since catalog version 3

Sets the velocity of the Rigidbody in meters per second (world coordinates).

**In Unity:** `Rigidbody.velocity`

**Inputs:**

- `x`: number
- `y`: number
- `z`: number

#### set gravity to {value}

`physics.setGravity` · Shape: command · Since catalog version 3

Sets the gravity of the whole scene in meters per second squared (Earth: 9.81, Moon: 1.62).

**In Unity:** `Physics.gravity / Rigidbody.useGravity`

**Inputs:**

- `value`: number

#### make me {type}

`physics.setBodyType` · Shape: command · Since catalog version 3

Makes the object fixed (static), moved by physics (dynamic) or moved by scripts only (kinematic).

**In Unity:** `Rigidbody.isKinematic`

**Inputs:**

- `type`: options: static, dynamic, kinematic

#### what is ahead within {meters} m?

`physics.whatIsAhead` · Shape: value · Since catalog version 3

Name of the object straight ahead within the distance, or empty if there is nothing (raycast).

**In Unity:** `Physics.Raycast`

**Inputs:**

- `meters`: number

#### distance ahead up to {meters} m

`physics.distanceAhead` · Shape: value · Since catalog version 3

Distance to the nearest obstacle straight ahead in meters, at most the given distance.

**In Unity:** `Physics.Raycast (RaycastHit.distance)`

**Inputs:**

- `meters`: number

## NPC and AI

#### when state {state}

`npc.whenState` · Shape: event (hat) · Since catalog version 5

Runs the script as soon as the NPC changes into this state (Unity: entering an Animator state).

**In Unity:** `Animator state machine (StateMachineBehaviour.OnStateEnter)`

**Inputs:**

- `state`: text

#### when dialog answer {answer}

`dialog.whenAnswer` · Shape: event (hat) · Since catalog version 5

Runs the script when the player picks the answer with this ID in a dialog. The ID is shown on the answer in the Dialog editor.

**In Unity:** no direct counterpart (a Blockwerk addition)

**Inputs:**

- `answer`: text

#### go to {target} (pathfinding)

`npc.goTo` · Shape: command · Since catalog version 5

The NPC walks over the navigation mesh to an object, around obstacles, and the script waits until it has arrived. Needs a Nav Agent component (Unity: NavMeshAgent.SetDestination).

**In Unity:** `NavMeshAgent.SetDestination`

**Inputs:**

- `target`: object, tag or asset (object)

#### follow {target} at distance {distance}

`npc.follow` · Shape: command · Since catalog version 5

From now on the NPC runs after the object and stops at the distance (in meters). "Stand still" or another movement block ends it. With a tag it follows the nearest object.

**In Unity:** `NavMeshAgent.SetDestination every frame`

**Inputs:**

- `target`: object, tag or asset (object)
- `distance`: number

#### flee from {target}

`npc.flee` · Shape: command · Since catalog version 5

The NPC runs away from the object until it is far enough away. "Stand still" ends it.

**In Unity:** `NavMeshAgent.SetDestination away from a target`

**Inputs:**

- `target`: object, tag or asset (object)

#### wander around within radius {radius}

`npc.wander` · Shape: command · Since catalog version 5

The NPC keeps walking to random points within the radius (in meters) around the place where it stands now.

**In Unity:** `NavMeshAgent.SetDestination with NavMesh.SamplePosition`

**Inputs:**

- `radius`: number

#### patrol along {route}

`npc.patrol` · Shape: command · Since catalog version 5

The NPC walks the object’s children as waypoints, in hierarchy order, around and around.

**In Unity:** `NavMeshAgent with waypoints`

**Inputs:**

- `route`: object, tag or asset (object)

#### stand still

`npc.stop` · Shape: command · Since catalog version 5

The NPC stops and ends Follow, Flee, Wander and Patrol started with blocks.

**In Unity:** `NavMeshAgent.ResetPath`

#### change state to {state}

`npc.setState` · Shape: command · Since catalog version 5

Sets the NPC’s state. Its behavior components run only in their state (Patrol in "patrol", Follow in "chase" …).

**In Unity:** `Animator.SetTrigger / SetInteger`

**Inputs:**

- `state`: text

#### start dialog {dialog}

`dialog.start` · Shape: command · Since catalog version 5

Shows a dialog (from the Dialog editor) and waits until the conversation is over. The player cannot move meanwhile.

**In Unity:** `Dialogue system (Yarn Spinner, Ink)`

**Inputs:**

- `dialog`: object, tag or asset (dialog)

#### current state

`npc.state` · Shape: value · Since catalog version 5

The name of the state the NPC is in now (empty if it has none).

**In Unity:** `Animator.GetCurrentAnimatorStateInfo`

#### do I see {target}?

`npc.sees` · Shape: condition · Since catalog version 5

True if the object is in the NPC’s view cone with no wall in between. The values (distance, angle) come from the Guard component.

**In Unity:** `Physics.Raycast + a field of view check`

**Inputs:**

- `target`: object, tag or asset (object)

#### do I hear {target}?

`npc.hears` · Shape: condition · Since catalog version 5

True if the object is within the NPC’s hearing radius (also behind walls).

**In Unity:** `Physics.OverlapSphere`

**Inputs:**

- `target`: object, tag or asset (object)

## Environment

#### set time of day to {hours} o’clock

`environment.setTimeOfDay` · Shape: command · Since catalog version 4

Sets the time of the sky (0 to 24, 12 is noon). Sun, moon, stars, light and fog follow.

**In Unity:** `Transform.rotation of a Directional Light, RenderSettings.skybox`

**Inputs:**

- `hours`: number

#### let time run with factor {factor}

`environment.setTimeSpeed` · Shape: command · Since catalog version 4

Lets the time of day run. Factor 1 is real time, 720 makes a day in two minutes, 0 stops the time.

**In Unity:** `Time.timeScale for a day-night script`

**Inputs:**

- `factor`: number

#### time of day (hours)

`environment.timeOfDay` · Shape: value · Since catalog version 4

The current time of day, 0 to 24.

**In Unity:** no direct counterpart (a Blockwerk addition)

#### set weather to {weather} in {seconds} s

`environment.setWeather` · Shape: command · Since catalog version 4

Changes the weather. It fades over the given time. Rain and snow fall around the camera; light and visibility change.

**In Unity:** `Particle System + RenderSettings.fog`

**Inputs:**

- `weather`: options: clear, rain, snow, fog
- `seconds`: number

#### set wind to {speed} m/s towards {direction} °

`environment.setWind` · Shape: command · Since catalog version 4

Sets the wind. It bends rain and snow. The direction is a compass angle (0 = forward, 90 = right).

**In Unity:** `WindZone`

**Inputs:**

- `speed`: number
- `direction`: number

#### set fog density to {percent} %

`environment.setFogDensity` · Shape: command · Since catalog version 4

Sets how thick the fog is: 0 is no fog, 100 is very thick.

**In Unity:** `RenderSettings.fogDensity`

**Inputs:**

- `percent`: number

#### set sun brightness to {percent} %

`environment.setSunBrightness` · Shape: command · Since catalog version 4

Dims or boosts the sun (100 is the strength from the scene).

**In Unity:** `Light.intensity`

**Inputs:**

- `percent`: number

#### switch light {target} {state}

`environment.setLight` · Shape: command · Since catalog version 4

Switches the light component of an object on or off.

**In Unity:** `Light.enabled`

**Inputs:**

- `target`: object, tag or asset (object)
- `state`: options: on, off

#### set light color of {target} to {color}

`environment.setLightColor` · Shape: command · Since catalog version 4

Changes the color of the light component of an object.

**In Unity:** `Light.color`

**Inputs:**

- `target`: object, tag or asset (object)
- `color`: color

#### set graphics level to {level}

`environment.setGraphicsLevel` · Shape: command · Since catalog version 4

Switches the graphics level, also while the game runs (for example from a settings menu).

**In Unity:** `QualitySettings.SetQualityLevel`

**Inputs:**

- `level`: options: low, medium, high, ultra

## Items

#### when I am {what}

`items.whenThing` · Shape: event (hat) · Since catalog version 5

Runs the script when something happens to the object: a player uses it, picks it up, opens or closes it (Pickup, Door, Chest and Switch components).

**In Unity:** no direct counterpart (a Blockwerk addition)

**Inputs:**

- `what`: options: is used, is picked up, is opened, is closed, is locked, is switched on, is switched off

#### when I {phase}

`items.whenHealth` · Shape: event (hat) · Since catalog version 5

Runs the script when the object takes damage or its hit points fall to 0 (Health component).

**In Unity:** no direct counterpart (a Blockwerk addition)

**Inputs:**

- `phase`: options: am hurt, die

#### give {count} × {item} to {target}

`items.add` · Shape: command · Since catalog version 5

Puts items into an object's inventory (it gets an Inventory component if it has none).

**In Unity:** `Inventory script (custom component)`

**Inputs:**

- `count`: number
- `item`: text
- `target`: object, tag or asset (object)

#### take {count} × {item} from {target}

`items.remove` · Shape: command · Since catalog version 5

Takes items from the inventory. If there are not enough, nothing happens.

**In Unity:** `Inventory script (custom component)`

**Inputs:**

- `count`: number
- `item`: text
- `target`: object, tag or asset (object)

#### {target} has {item}?

`items.has` · Shape: condition · Since catalog version 5

True if the object has at least one of them in its inventory.

**In Unity:** `Inventory script (custom component)`

**Inputs:**

- `target`: object, tag or asset (object)
- `item`: text

#### count of {item} on {target}

`items.count` · Shape: value · Since catalog version 5

How many of this item the object has in its inventory.

**In Unity:** `Inventory script (custom component)`

**Inputs:**

- `item`: text
- `target`: object, tag or asset (object)

#### {action} {target}

`items.operate` · Shape: command · Since catalog version 5

Opens, closes or toggles a door, gate, chest or switch. The block needs no key – build the condition yourself in front of it.

**In Unity:** `Interactable script (custom component)`

**Inputs:**

- `action`: options: open, close, toggle
- `target`: object, tag or asset (object)

#### pick up {target}

`items.pickUp` · Shape: command · Since catalog version 5

This object picks up a pickup object (Pickup component): it goes into the inventory and leaves the scene.

**In Unity:** `Collectible script (custom component)`

**Inputs:**

- `target`: object, tag or asset (object)

#### deal {amount} damage to {target}

`items.damage` · Shape: command · Since catalog version 5

Takes hit points from the object. If they fall to 0, it dies.

**In Unity:** `Health script (custom component)`

**Inputs:**

- `amount`: number
- `target`: object, tag or asset (object)

#### heal {target} by {amount}

`items.heal` · Shape: command · Since catalog version 5

Gives hit points back to the object (at most up to the maximum).

**In Unity:** `Health script (custom component)`

**Inputs:**

- `amount`: number
- `target`: object, tag or asset (object)

#### health of {target}

`items.health` · Shape: value · Since catalog version 5

The hit points of the object (0 if it has no Health component).

**In Unity:** `Health script (custom component)`

**Inputs:**

- `target`: object, tag or asset (object)

## Effects

#### create effect {effect} at {at}

`effects.spawn` · Shape: command · Since catalog version 4

Plays an effect at the position of an object. Dust, sparks, explosion and sparkle play once and vanish; smoke, fire, magic, rain and snow keep running.

**In Unity:** `Object.Instantiate of a Particle System prefab`

**Inputs:**

- `effect`: options: dust, sparks, explosion, smoke, fire, magic, rain, snow, sparkle
- `at`: object, tag or asset (object)

#### start particle system {target}

`effects.start` · Shape: command · Since catalog version 4

Starts the particle system of an object (Unity: ParticleSystem.Play).

**In Unity:** `ParticleSystem.Play`

**Inputs:**

- `target`: object, tag or asset (object)

#### stop particle system {target}

`effects.stop` · Shape: command · Since catalog version 4

Stops the particle system of an object. Particles already flying still fade out (Unity: ParticleSystem.Stop).

**In Unity:** `ParticleSystem.Stop`

**Inputs:**

- `target`: object, tag or asset (object)

## UI

#### show UI {ui}

`ui.show` · Shape: command · Since catalog version 6

Shows a UI canvas that is set to "by hand" (a settings menu, say). The canvas has to be on an object with the "UI Canvas" component in the scene.

**In Unity:** `GameObject.SetActive on a Canvas`

**Inputs:**

- `ui`: object, tag or asset (ui)

#### hide UI {ui}

`ui.hide` · Shape: command · Since catalog version 6

Hides a UI canvas again that was opened with "show UI".

**In Unity:** `GameObject.SetActive on a Canvas`

**Inputs:**

- `ui`: object, tag or asset (ui)

## Scenes and Saving

#### load scene {scene} with loading screen, spawn point {spawn}

`scenes.load` · Shape: command (ends the stack) · Since catalog version 5

Changes to another scene and shows a loading screen. The player's items, health and the game variables are kept. The player appears at the object tagged "Spawn" with this name (empty: the first one).

**In Unity:** `SceneManager.LoadSceneAsync`

**Inputs:**

- `scene`: object, tag or asset (scene)
- `spawn`: text

#### restart scene

`scenes.restart` · Shape: command (ends the stack) · Since catalog version 5

Loads the current scene again with a loading screen; the scene state is lost, items and variables stay.

**In Unity:** `SceneManager.LoadScene(SceneManager.GetActiveScene().name)`

#### save game to slot {slot}

`saves.save` · Shape: command · Since catalog version 6

Saves the current scene, all variables marked "saved", and the players' position, inventory, health and stamina into one of three slots. Enemies, doors and chests are not saved.

**In Unity:** `PlayerPrefs / JSON file in Application.persistentDataPath`

**Inputs:**

- `slot`: options: 1, 2, 3

#### load game from slot {slot}

`saves.load` · Shape: command · Since catalog version 6

Continues the game at the saved place (with a loading screen). If the slot is empty the game shows a notice and nothing happens.

**In Unity:** `PlayerPrefs / JSON file in Application.persistentDataPath`

**Inputs:**

- `slot`: options: 1, 2, 3

#### slot {slot} is used?

`saves.slotUsed` · Shape: condition · Since catalog version 6

True if this slot holds a save (for a "Continue" in the main menu, say).

**In Unity:** `PlayerPrefs.HasKey / File.Exists`

**Inputs:**

- `slot`: options: 1, 2, 3

## Lists and Dictionaries

#### new empty list

`data.newList` · Shape: value · Since catalog version 7

A new list without items. For example put it in a variable.

**In Unity:** `new List<T>()`

#### new empty dictionary

`data.newDictionary` · Shape: value · Since catalog version 7

A new dictionary without entries. Every entry has a key (text) and a value.

**In Unity:** `new Dictionary<K, V>()`

#### split {text} at {separator}

`data.split` · Shape: value · Since catalog version 7

Cuts a text at every separator into a list.

**In Unity:** `string.Split`

**Inputs:**

- `text`: text
- `separator`: text

#### add {item} to {list}

`data.listAdd` · Shape: command · Since catalog version 7

Adds an item to the end of the list.

**In Unity:** `List.Add`

**Inputs:**

- `item`: any value
- `list`: any value

#### insert {item} at {index} of {list}

`data.listInsert` · Shape: command · Since catalog version 7

Inserts an item at the place (1 is the first). The following ones move back.

**In Unity:** `List.Insert`

**Inputs:**

- `item`: any value
- `index`: number
- `list`: any value

#### delete item {index} of {list}

`data.listRemoveAt` · Shape: command · Since catalog version 7

Deletes the item at the place (1 is the first).

**In Unity:** `List.RemoveAt`

**Inputs:**

- `index`: number
- `list`: any value

#### replace item {index} of {list} with {item}

`data.listSet` · Shape: command · Since catalog version 7

Replaces the item at the place (1 is the first).

**In Unity:** `list[index] = item`

**Inputs:**

- `index`: number
- `list`: any value
- `item`: any value

#### delete all items of {list}

`data.listClear` · Shape: command · Since catalog version 7

Empties the list.

**In Unity:** `List.Clear`

**Inputs:**

- `list`: any value

#### item {index} of {list}

`data.listGet` · Shape: value · Since catalog version 7

The item at the place (1 is the first). If there is none, the result is empty.

**In Unity:** `list[index]`

**Inputs:**

- `index`: number
- `list`: any value

#### length of {list}

`data.listLength` · Shape: value · Since catalog version 7

How many items the list has.

**In Unity:** `List.Count`

**Inputs:**

- `list`: any value

#### {list} contains {item}?

`data.listContains` · Shape: condition · Since catalog version 7

True if the item is in the list (upper and lower case do not matter).

**In Unity:** `List.Contains`

**Inputs:**

- `list`: any value
- `item`: any value

#### place of {item} in {list}

`data.listIndexOf` · Shape: value · Since catalog version 7

The place of the first match (1 is the first), 0 if the item is missing.

**In Unity:** `List.IndexOf`

**Inputs:**

- `item`: any value
- `list`: any value

#### join {list} with {separator}

`data.listJoin` · Shape: value · Since catalog version 7

Makes one text of the items, separated by the separator.

**In Unity:** `string.Join`

**Inputs:**

- `list`: any value
- `separator`: text

#### set {key} in {dictionary} to {value}

`data.dictSet` · Shape: command · Since catalog version 7

Creates the entry with this key or overwrites it.

**In Unity:** `dictionary[key] = value`

**Inputs:**

- `key`: text
- `dictionary`: any value
- `value`: any value

#### delete {key} from {dictionary}

`data.dictRemove` · Shape: command · Since catalog version 7

Deletes the entry with this key.

**In Unity:** `Dictionary.Remove`

**Inputs:**

- `key`: text
- `dictionary`: any value

#### {key} of {dictionary}

`data.dictGet` · Shape: value · Since catalog version 7

The value of this key. If there is none, the result is empty.

**In Unity:** `dictionary[key]`

**Inputs:**

- `key`: text
- `dictionary`: any value

#### {dictionary} has {key}?

`data.dictHas` · Shape: condition · Since catalog version 7

True if the key exists.

**In Unity:** `Dictionary.ContainsKey`

**Inputs:**

- `dictionary`: any value
- `key`: text

#### keys of {dictionary}

`data.dictKeys` · Shape: value · Since catalog version 7

A list of all keys, in the order they were added.

**In Unity:** `Dictionary.Keys`

**Inputs:**

- `dictionary`: any value

#### number of entries in {dictionary}

`data.dictSize` · Shape: value · Since catalog version 7

How many entries the dictionary has.

**In Unity:** `Dictionary.Count`

**Inputs:**

- `dictionary`: any value

#### for each {name} in {list}

`data.forEachItem` · Shape: C-shaped command · Since catalog version 7

Goes through the items of a list one after the other. The block "local variable" with the chosen name gives the current item. For a dictionary it goes through the keys.

**In Unity:** `foreach`

**Inputs:**

- `name`: text
- `list`: any value
- `body`: blocks

## Code

#### code {code}

`code.run` · Shape: command · Since catalog version 7

JavaScript for advanced users. Available are self (this object), game (the functions the blocks use), scene (find objects) and three (the 3D library). Use yield* game.wait(1) to wait. The code is never rewritten automatically.

**In Unity:** `the body of a C# method`

**Inputs:**

- `code`: text

#### code value {code}

`code.value` · Shape: value · Since catalog version 7

A JavaScript expression as a value, for example self.position.y. Available are self, game, scene and three.

**In Unity:** `a C# expression`

**Inputs:**

- `code`: text

## My Blocks

#### command {name}

`custom.defineCommand` · Shape: event (hat) · Since catalog version 7

Defines a custom command block. What hangs below it runs when the block is used.

**In Unity:** `a method (void)`

**Inputs:**

- `name`: text

#### value {name}

`custom.defineValue` · Shape: event (hat) · Since catalog version 7

Defines a custom value block. Use "return" to set the result.

**In Unity:** `a method that returns a value`

**Inputs:**

- `name`: text

#### condition {name}

`custom.defineCondition` · Shape: event (hat) · Since catalog version 7

Defines a custom condition. Use "return" to say whether it is true.

**In Unity:** `a method that returns bool`

**Inputs:**

- `name`: text

#### return {value}

`custom.return` · Shape: command (ends the stack) · Since catalog version 7

Ends the custom block at once. In a value or condition block the item is the result.

**In Unity:** `return`

**Inputs:**

- `value`: any value

#### input {name}

`custom.param` · Shape: value · Since catalog version 7

The value of an input of the custom block this block sits in.

**In Unity:** `a method parameter`

**Inputs:**

- `name`: text

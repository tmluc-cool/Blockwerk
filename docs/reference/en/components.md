# Components

Generated from the block catalog and the component definitions. Do not edit by hand.

### Mesh Renderer

`meshRenderer`

Displays a shape with a material.

**In Unity:** `MeshRenderer + MeshFilter`

**Fields:**

- Model (`model`): asset (model), default: none
- Shape (`shape`): options: Cube, Sphere, Cylinder, Capsule, Plane, Ramp, Stairs, default: "cube"
- Cast Shadows (`castShadows`): boolean, default: true
- Receive Shadows (`receiveShadows`): boolean, default: true
- Color (`color`): color, default: "#d9d9d9"
- Metallic (`metallic`): number, default: 0
- Smoothness (`smoothness`): number, default: 0.45
- Texture (`texture`): options: None, Tiles, default: "none"
- Tiling (`tiling`): number, default: 1

### Character

`character`

A game character: a model with a body height, parts that can be hidden and tinted, items on attachment points and animations. Humanoid skeletons are recognized and the standard animations of the library work on them. Models without a skeleton bob and lean while moving.

**In Unity:** `Animator + Avatar (Humanoid rig)`

**Fields:**

- Model (`model`): asset (model), default: none
- Body Height (0 = original size) (`bodyHeight`): number, default: 1.8
- Movement Profile (`profile`): options: Custom, Arcade, Realistic, Agile, Heavy, Floating, default: "custom"
- Build (Width) (`build`): number, default: 1
- Head Size (`headScale`): number, default: 1
- Arm Length (`armScale`): number, default: 1
- Leg Length (`legScale`): number, default: 1
- Hidden Parts (separated by ;) (`hiddenParts`): string, default: ""
- Shown Gear Parts (separated by ;) (`shownGear`): string, default: ""
- Colors (Part=#rrggbb; …) (`tints`): string, default: ""
- Equipment (model@point; …) (`attachments`): string, default: ""
- Sound Set (event=sound; …) (`sounds`): string, default: ""
- Transfer Library Animations (`libraryAnimations`): boolean, default: true
- Animations From (empty = Knight) (`animationSource`): asset (model), default: none
- Skeleton Map (standard=bone; …) (`boneMap`): string, default: ""
- Bobbing without Skeleton (`rigidMotion`): boolean, default: true

### Animator

`animator`

Plays the animations of the model. With a controller component it picks idle, walk, run, jump, fall, land and crouch by itself and blends smoothly.

**In Unity:** `Animator`

**Fields:**

- Driven by Controller (`useControls`): boolean, default: true
- Default State (`defaultState`): options: Idle, Walk, Run, Jump, Fall, Land, Crouch, Crouch Walk, Attack, Hit, Death, Wave, Cheer, Interact, Roll, Block, Sit, default: "idle"
- Transition Duration (`crossFade`): number, default: 0.2
- Speed (`speed`): number, default: 1
- Events (state@seconds=name; …) (`markers`): string, default: ""
- Walk Animation Speed (`walkClipSpeed`): number, default: 2.2
- Run Animation Speed (`runClipSpeed`): number, default: 5.5

### Rigidbody

`rigidbody`

Lets physics move the object: gravity, pushes, falling over. "Kinematic" moves only by script or animation but pushes other bodies.

**In Unity:** `Rigidbody`

**Fields:**

- Body Type (`bodyType`): options: Dynamic, Kinematic, default: "dynamic"
- Mass (`mass`): number, default: 1
- Drag (`drag`): number, default: 0
- Angular Drag (`angularDrag`): number, default: 0.05
- Use Gravity (`useGravity`): boolean, default: true
- Freeze Rotation X (`freezeRotationX`): boolean, default: false
- Freeze Rotation Y (`freezeRotationY`): boolean, default: false
- Freeze Rotation Z (`freezeRotationZ`): boolean, default: false
- Continuous Collision (`continuous`): boolean, default: false

### Box Collider

`boxCollider`

Box-shaped collision volume.

**In Unity:** `BoxCollider`

**Fields:**

- Is Trigger (`isTrigger`): boolean, default: false
- Center (`center`): vector3, default: [0,0,0]
- Friction (`friction`): number, default: 0.6
- Bounciness (`bounciness`): number, default: 0
- Size (`size`): vector3, default: [1,1,1]

### Sphere Collider

`sphereCollider`

Sphere-shaped collision volume.

**In Unity:** `SphereCollider`

**Fields:**

- Is Trigger (`isTrigger`): boolean, default: false
- Center (`center`): vector3, default: [0,0,0]
- Friction (`friction`): number, default: 0.6
- Bounciness (`bounciness`): number, default: 0
- Radius (`radius`): number, default: 0.5

### Capsule Collider

`capsuleCollider`

Capsule-shaped collision volume, e.g. for characters.

**In Unity:** `CapsuleCollider`

**Fields:**

- Is Trigger (`isTrigger`): boolean, default: false
- Center (`center`): vector3, default: [0,0,0]
- Friction (`friction`): number, default: 0.6
- Bounciness (`bounciness`): number, default: 0
- Radius (`radius`): number, default: 0.5
- Height (`height`): number, default: 2

### Cylinder Collider

`cylinderCollider`

Cylinder-shaped collision volume, e.g. for pillars and barrels.

**In Unity:** `none (use a CapsuleCollider or MeshCollider)`

**Fields:**

- Is Trigger (`isTrigger`): boolean, default: false
- Center (`center`): vector3, default: [0,0,0]
- Friction (`friction`): number, default: 0.6
- Bounciness (`bounciness`): number, default: 0
- Radius (`radius`): number, default: 0.5
- Height (`height`): number, default: 1

### Mesh Collider

`meshCollider`

Uses the model as collision shape. "Convex" wraps it in a hull; only convex mesh colliders can move with a Rigidbody.

**In Unity:** `MeshCollider`

**Fields:**

- Is Trigger (`isTrigger`): boolean, default: false
- Center (`center`): vector3, default: [0,0,0]
- Friction (`friction`): number, default: 0.6
- Bounciness (`bounciness`): number, default: 0
- Convex (`convex`): boolean, default: false

### Character Controller

`characterController`

Capsule for player characters: walks up slopes to the limit, climbs stairs, sticks to the ground going downhill, glides along walls and pushes loose objects.

**In Unity:** `CharacterController`

**Fields:**

- Height (`height`): number, default: 1.8
- Radius (`radius`): number, default: 0.3
- Center (`center`): vector3, default: [0,0.9,0]
- Slope Limit (`slopeLimit`): number, default: 45
- Step Offset (`stepOffset`): number, default: 0.35
- Skin Width (`skinWidth`): number, default: 0.08
- Ground Snap (`snapDistance`): number, default: 0.3
- Push Mass (`pushMass`): number, default: 70

### Third Person Controller

`thirdPersonControl`

Moves the character relative to the camera: walk, sprint, crouch, jump. Needs a Character Controller.

**In Unity:** `ThirdPersonController (Starter Assets)`

**Fields:**

- Player (`player`): options: Player 1, Player 2, default: "1"
- Walk Speed (`walkSpeed`): number, default: 2.2
- Sprint Speed (`runSpeed`): number, default: 5.5
- Crouch Speed (`crouchSpeed`): number, default: 1.2
- Speed Change Rate (`acceleration`): number, default: 10
- Rotation Smooth Time (`rotationSmoothTime`): number, default: 0.12
- Jump Height (`jumpHeight`): number, default: 1.2
- Gravity (`gravity`): number, default: 15
- Air Control (`airControl`): number, default: 0.5
- Coyote Time (`coyoteTime`): number, default: 0.15
- Jump Buffer (`jumpBuffer`): number, default: 0.15
- Crouch Height (`crouchHeight`): number, default: 1.1

### First Person Controller

`firstPersonControl`

First person: mouse or right stick turn the character, movement follows the view. Needs a Character Controller.

**In Unity:** `FirstPersonController (Starter Assets)`

**Fields:**

- Player (`player`): options: Player 1, Player 2, default: "1"
- Walk Speed (`walkSpeed`): number, default: 2.2
- Sprint Speed (`runSpeed`): number, default: 5.5
- Crouch Speed (`crouchSpeed`): number, default: 1.2
- Speed Change Rate (`acceleration`): number, default: 10
- Rotation Smooth Time (`rotationSmoothTime`): number, default: 0.12
- Jump Height (`jumpHeight`): number, default: 1.2
- Gravity (`gravity`): number, default: 15
- Air Control (`airControl`): number, default: 0.5
- Coyote Time (`coyoteTime`): number, default: 0.15
- Jump Buffer (`jumpBuffer`): number, default: 0.15
- Crouch Height (`crouchHeight`): number, default: 1.1

### Top Down Controller

`topDownControl`

For games seen from above: move in screen directions, the character turns into the walking direction. Needs a Character Controller.

**In Unity:** `top-down controller (custom script)`

**Fields:**

- Player (`player`): options: Player 1, Player 2, default: "1"
- Walk Speed (`walkSpeed`): number, default: 2.2
- Sprint Speed (`runSpeed`): number, default: 5.5
- Crouch Speed (`crouchSpeed`): number, default: 1.2
- Speed Change Rate (`acceleration`): number, default: 10
- Rotation Smooth Time (`rotationSmoothTime`): number, default: 0.12
- Jump Height (`jumpHeight`): number, default: 1.2
- Gravity (`gravity`): number, default: 15
- Air Control (`airControl`): number, default: 0.5
- Coyote Time (`coyoteTime`): number, default: 0.15
- Jump Buffer (`jumpBuffer`): number, default: 0.15
- Crouch Height (`crouchHeight`): number, default: 1.1

### Vehicle Controller

`vehicleControl`

Drives like a toy car: forward accelerates, back brakes and reverses, left/right steer, sprint is turbo. Needs a Character Controller.

**In Unity:** `WheelCollider + vehicle script`

**Fields:**

- Player (`player`): options: Player 1, Player 2, default: "1"
- Max Speed (`maxSpeed`): number, default: 12
- Acceleration (`acceleration`): number, default: 6
- Braking (`braking`): number, default: 14
- Reverse Speed (`reverseSpeed`): number, default: 4
- Turn Speed (`turnSpeed`): number, default: 90
- Gravity (`gravity`): number, default: 15

### Double Jump

`doubleJump`

Ability: jump again in the air. The jump button triggers the second jump.

**In Unity:** `custom script (extra jump)`

**Fields:**

- Second Jump Height (`height`): number, default: 1
- Extra Jumps (`jumps`): number, default: 1

### Roll

`roll`

Ability: a dodge roll in the facing direction with the "Roll" action (Q key, gamepad RB). The character is low and cannot steer while rolling.

**In Unity:** `custom script (dodge roll)`

**Fields:**

- Speed (`speed`): number, default: 6
- Duration (`seconds`): number, default: 0.55
- Cooldown (`cooldown`): number, default: 0.4

### Glide

`glide`

Ability: holding the jump button in the air while falling slows the fall.

**In Unity:** `custom script (glide)`

**Fields:**

- Fall Speed (`fallSpeed`): number, default: 1.5

### Stamina

`stamina`

Ability: sprinting uses stamina, which refills when resting. Without stamina the character only walks.

**In Unity:** `custom script (stamina)`

**Fields:**

- Maximum (seconds of sprinting) (`max`): number, default: 5
- Drain per Second (`drain`): number, default: 1
- Refill per Second (`regen`): number, default: 0.8
- Delay before Refill (`delay`): number, default: 0.8

### Camera

`camera`

Renders the scene in the game from this object.

**In Unity:** `Camera`

**Fields:**

- Field of View (`fieldOfView`): number, default: 60
- Near (`near`): number, default: 0.1
- Far (`far`): number, default: 1000
- Player (`player`): options: All (full screen), Player 1, Player 2, default: "all"
- Split Screen (`split`): options: Side by Side, Top and Bottom, default: "vertical"
- Blend Time (`blendTime`): number, default: 0.5

### Third Person Camera

`thirdPersonCamera`

Camera behavior: orbits behind the character (mouse or right stick), follows with a slight lag, zooms with the mouse wheel and avoids walls. Goes on an object with a Camera.

**In Unity:** `Cinemachine FreeLook camera`

**Fields:**

- Target (empty = player) (`target`): object, default: none
- Distance (`distance`): number, default: 4
- Min Distance (`minDistance`): number, default: 1.5
- Max Distance (`maxDistance`): number, default: 8
- Height (`height`): number, default: 1.5
- Shoulder Offset (`shoulder`): number, default: 0.4
- Damping (`damping`): number, default: 0.1
- Sensitivity (`sensitivity`): number, default: 1
- Invert Y (`invertY`): boolean, default: false
- Bottom Clamp (`minPitch`): number, default: -35
- Top Clamp (`maxPitch`): number, default: 70
- Avoid Obstacles (`avoidWalls`): boolean, default: true
- Camera Radius (`cameraRadius`): number, default: 0.2
- Sprint FOV Boost (`sprintFov`): number, default: 8

### First Person Camera

`firstPersonCamera`

Camera behavior: view from the eyes of the character. Look up and down with mouse or right stick; left and right turn the character (First Person Controller).

**In Unity:** `Cinemachine virtual camera (first person)`

**Fields:**

- Target (empty = player) (`target`): object, default: none
- Eye Height (`eyeHeight`): number, default: 1.6
- Sensitivity (`sensitivity`): number, default: 1
- Invert Y (`invertY`): boolean, default: false
- Bottom Clamp (`minPitch`): number, default: -80
- Top Clamp (`maxPitch`): number, default: 80
- Sprint FOV Boost (`sprintFov`): number, default: 5

### Top Down Camera

`topDownCamera`

Camera behavior: follows the target from above at an angle, without turning.

**In Unity:** `Cinemachine virtual camera (top down)`

**Fields:**

- Target (empty = player) (`target`): object, default: none
- Distance (`distance`): number, default: 14
- Angle (`angle`): number, default: 60
- Heading (`direction`): number, default: 0
- Damping (`damping`): number, default: 0.15

### Side View Camera

`sideCamera`

Camera behavior: shows the target from the side (looking along +Z) like a platformer.

**In Unity:** `Cinemachine virtual camera (side view)`

**Fields:**

- Target (empty = player) (`target`): object, default: none
- Distance (`distance`): number, default: 10
- Height (`height`): number, default: 1.5
- Follow Height (`followHeight`): boolean, default: true
- Damping (`damping`): number, default: 0.15

### Fixed Camera

`fixedCamera`

Camera behavior: stays in place. With "Look At" it turns smoothly towards the target, like a security camera.

**In Unity:** `Cinemachine virtual camera (fixed)`

**Fields:**

- Look At (`lookAt`): object, default: none
- Look At Player (`lookAtPlayer`): boolean, default: false
- Damping (`damping`): number, default: 0.2

### Camera Path

`cameraPath`

Camera behavior: moves smoothly through waypoints. The waypoints are the children of the path object, in hierarchy order.

**In Unity:** `Cinemachine Dolly Track`

**Fields:**

- Path (`path`): object, default: none
- Duration (`duration`): number, default: 5
- Loop (`loop`): boolean, default: false
- Play On Start (`playOnStart`): boolean, default: true
- Look At (empty = path direction) (`lookAt`): object, default: none

### Shared Camera

`sharedCamera`

Camera behavior for player 2 without split screen: shows both players and moves back as they move apart.

**In Unity:** `Cinemachine Target Group`

**Fields:**

- Min Distance (`distance`): number, default: 10
- Framing (`framing`): number, default: 1.4
- Angle (`angle`): number, default: 45
- Heading (`direction`): number, default: 0
- Damping (`damping`): number, default: 0.3

### Post-Processing

`postProcessing`

Image effects on this camera: tone mapping, bloom, ambient occlusion, anti-aliasing, color grading, vignette and depth of field. The graphics level limits what runs.

**In Unity:** `Volume`

**Fields:**

- Tone Mapping (`toneMapping`): options: ACES (filmic), AgX, Neutral, None, default: "aces"
- Exposure (`exposure`): number, default: 0.6
- Bloom (`bloom`): boolean, default: true
- Bloom Intensity (`bloomIntensity`): number, default: 0.2
- Bloom Threshold (`bloomThreshold`): number, default: 1
- Ambient Occlusion (`ambientOcclusion`): boolean, default: true
- Occlusion Radius (`aoRadius`): number, default: 2
- Occlusion Intensity (`aoIntensity`): number, default: 2.5
- Anti-Aliasing (`antialiasing`): boolean, default: true
- Saturation (`saturation`): number, default: 1.05
- Contrast (`contrast`): number, default: 0.04
- Brightness (`brightness`): number, default: 0
- Vignette (`vignette`): boolean, default: true
- Vignette Darkness (`vignetteDarkness`): number, default: 0.35
- Depth of Field (`depthOfField`): boolean, default: false
- Focus Distance (`focusDistance`): number, default: 8
- Blur Size (`bokehScale`): number, default: 2

### Particle System

`particleSystem`

Creates many small particles for dust, fire, smoke, sparks and other effects. A template sets all modules at once.

**In Unity:** `Particle System`

**Fields:**

- Template (`preset`): options: Custom, Dust, Sparks, Explosion, Smoke, Fire, Magic, Rain, Snow, Sparkle, default: "custom"
- Play On Awake (`playOnAwake`): boolean, default: true
- Looping (`loop`): boolean, default: true
- Duration (`duration`): number, default: 5
- Simulation Space (`space`): options: World, Local, default: "world"
- Rate over Time (`rate`): number, default: 20
- Burst (`burst`): number, default: 0
- Max Particles (`maxParticles`): number, default: 500
- Shape (`shape`): options: Point, Sphere, Cone, Box, Circle, default: "cone"
- Radius (`shapeRadius`): number, default: 0.3
- Cone Angle (`coneAngle`): number, default: 25
- Box Size (`shapeSize`): vector3, default: [1,1,1]
- Start Lifetime (`lifetime`): number, default: 1.5
- Variation (`lifetimeVariance`): number, default: 0.3
- Start Speed (`speed`): number, default: 2
- Speed Variation (`speedVariance`): number, default: 0.3
- Start Size (`startSize`): number, default: 0.2
- End Size (`endSize`): number, default: 0
- Size Variation (`sizeVariance`): number, default: 0.3
- Start Color (`startColor`): color, default: "#ffffff"
- End Color (`endColor`): color, default: "#ffffff"
- Start Opacity (`startAlpha`): number, default: 1
- End Opacity (`endAlpha`): number, default: 0
- Additive Blend (`additive`): boolean, default: false
- Gravity Modifier (`gravity`): number, default: 0
- Drag (`drag`): number, default: 0

### Terrain

`terrain`

A landscape from a height map with four paint layers, grass and collision. The object’s origin is at the center. Shape and paint it with the terrain tools in the inspector.

**In Unity:** `Terrain`

**Fields:**

- Terrain Data (`terrain`): asset (terrain), default: none
- Layer 1 (Grass) (`layer0`): color, default: "#5f8f3c"
- Layer 2 (Dirt) (`layer1`): color, default: "#8b6b47"
- Layer 3 (Rock) (`layer2`): color, default: "#807d78"
- Layer 4 (Sand) (`layer3`): color, default: "#d6c48f"
- Grass (`grass`): boolean, default: true
- Clumps per m² (`grassDensity`): number, default: 2
- Grass Height (`grassHeight`): number, default: 0.55
- Grass Color (`grassColor`): color, default: "#7fb24a"
- Grows on Layer (`grassLayer`): number, default: 1
- No Grass Below (`grassMinHeight`): number, default: -1000

### Water

`water`

A water surface with waves, reflections and sun glints. The surface lies at the height of the object. Characters swim in it when "Swimmable" is on. The graphics level decides how the water reflects.

**In Unity:** `Water`

**Fields:**

- Width (`width`): number, default: 20
- Length (`depth`): number, default: 20
- Shallow Color (`shallowColor`): color, default: "#3ea5bc"
- Deep Color (`deepColor`): color, default: "#0c3a58"
- Wave Height (`waveHeight`): number, default: 0.12
- Wave Speed (`waveSpeed`): number, default: 1
- Clarity (`clarity`): number, default: 0.5
- Swimmable (`swimmable`): boolean, default: true

### Nav Agent

`navAgent`

Walks the object over the navigation mesh to a destination, around obstacles and other agents. Pathfinding works as soon as the navigation mesh is built (Navigation window). The NPC components (Wander, Patrol, Follow …) or the "go to …" block give the agent its destinations.

**In Unity:** `NavMeshAgent`

**Fields:**

- Speed (m/s) (`speed`): number, default: 3.5
- Acceleration (`acceleration`): number, default: 12
- Stopping Distance (`stoppingDistance`): number, default: 0.3
- Angular Speed (°/s) (`turnSpeed`): number, default: 540
- Radius (`radius`): number, default: 0.4
- Height (`height`): number, default: 1.8
- Avoid Others (`avoidance`): boolean, default: true

### Nav Obstacle

`navObstacle`

Decides how the object enters the navigation mesh: as an extra box agents walk around, or not at all ("Ignore", e.g. for decoration that lies in the way but does not block). Without this component the object’s static colliders count.

**In Unity:** `NavMeshObstacle`

**Fields:**

- Mode (`mode`): options: Obstacle (box), Ignore, default: "obstacle"
- Center (`center`): vector3, default: [0,0.5,0]
- Size (`size`): vector3, default: [1,1,1]

### NPC

`npc`

Gives the object a state (for example "patrol" or "chase"). The behavior components (Wander, Patrol, Follow, Flee, Attack …) run only in their state, and Guards change it when they notice someone. In play mode the state is drawn above the NPC; the blocks "When state" and "change state" build your own behavior.

**In Unity:** `Animator (state machine)`

**Fields:**

- Start State (`startState`): string, default: "patrol"
- Show State in Play Mode (`showState`): boolean, default: true
- Label Height (`labelHeight`): number, default: 2.3

### Wander

`wander`

The NPC keeps walking to random points around where it started and stops in between. Needs a Nav Agent and the navigation mesh.

**In Unity:** `NavMeshAgent (random destinations)`

**Fields:**

- Radius (`radius`): number, default: 8
- Pause (shortest) (`minPause`): number, default: 1
- Pause (longest) (`maxPause`): number, default: 4
- Speed (m/s) (`speed`): number, default: 1.6
- Active in State (`activeInState`): string, default: "wander"

### Patrol

`patrol`

The NPC walks its waypoints: the children of the object in the "Waypoints" field, in hierarchy order. At the end it goes around again or walks back. After an interruption (for example a chase) it carries on at the nearest waypoint.

**In Unity:** `NavMeshAgent (waypoints)`

**Fields:**

- Waypoints (parent object) (`route`): object, default: none
- Mode (`mode`): options: Loop, Ping-pong, default: "loop"
- Wait at Each Point (`wait`): number, default: 1
- Speed (m/s) (`speed`): number, default: 1.8
- Active in State (`activeInState`): string, default: "patrol"

### Follow

`follow`

The NPC runs after the nearest object with the target tag, around obstacles, and stops at the set distance. It runs only in the state "chase" (adjustable); a Guard puts it there when it sees the target.

**In Unity:** `NavMeshAgent (SetDestination)`

**Fields:**

- Target Tag (`targetTag`): string, default: "Player"
- Distance (`distance`): number, default: 1.6
- Speed (m/s) (`speed`): number, default: 3.6
- Active in State (`activeInState`): string, default: "chase"

### Flee

`flee`

The NPC runs away from the nearest object with the target tag until the safe distance is reached. It runs only in the state "flee" (adjustable).

**In Unity:** `NavMeshAgent (flee)`

**Fields:**

- Target Tag (`targetTag`): string, default: "Player"
- Safe Distance (`safeDistance`): number, default: 14
- Speed (m/s) (`speed`): number, default: 4.5
- Active in State (`activeInState`): string, default: "flee"

### Guard

`guard`

The guard sees objects with the target tag in its view cone (not through walls) and hears them within the hearing radius. When it notices someone the NPC switches to the state "chase"; when it loses them for the set time it goes back to the state "patrol". The view cone is drawn in the Scene view while the object is selected.

**In Unity:** `Physics.Raycast + field of view`

**Fields:**

- Target Tag (`targetTag`): string, default: "Player"
- View Distance (`viewDistance`): number, default: 14
- View Cone (full angle) (`viewAngle`): number, default: 110
- Hearing Radius (`hearingRadius`): number, default: 4
- Eye Height (`eyeHeight`): number, default: 1.6
- State When Noticed (`seenState`): string, default: "chase"
- State When Lost (`lostState`): string, default: "patrol"
- Lose Target After (`loseTime`): number, default: 4
- Active in State (empty = always) (`activeInState`): string, default: ""

### Attack

`attack`

The NPC attacks the nearest object with the target tag as soon as it is in reach: it turns, winds up briefly (plays the attack animation) and hits if the target is still there. Melee hits in the cone in front of it, ranged hits from afar when nothing is in the way. It runs only in the state "chase" (adjustable).

**In Unity:** `Enemy attack (custom component)`

**Fields:**

- Mode (`mode`): options: Melee, Ranged, default: "melee"
- Target Tag (`targetTag`): string, default: "Player"
- Reach (`range`): number, default: 1.9
- Damage (`damage`): number, default: 10
- Time Between Attacks (`cooldown`): number, default: 1.2
- Wind-Up (`windup`): number, default: 0.35
- Active in State (`activeInState`): string, default: "chase"

### Inventory

`inventory`

The player’s inventory: items with a name and a count. "Starting Items" takes a list like "Key:1, Coin:5". The blocks "add … to inventory", "do I have …?" and "count" work with it; chests, pickups and dialogs put things here. Even without the component an object gets an inventory with its first item.

**In Unity:** `Inventory (custom component)`

**Fields:**

- Starting Items (`startItems`): string, default: ""

### Health

`health`

Hit points for players, enemies and things that break. Attacks, projectiles and the block "damage … " take them away, "heal" gives some back. After a hit the object is briefly invulnerable. At zero: destroy, respawn (at the last checkpoint) or just raise the event "when I am defeated".

**In Unity:** `Health (custom component)`

**Fields:**

- Max Health (`max`): number, default: 100
- Invulnerable After a Hit (`invulnerable`): number, default: 0.4
- On Death (`onDeath`): options: Destroy the object, Respawn, Nothing (event only), default: "destroy"
- Respawn After (`respawnDelay`): number, default: 2

### Melee Hit

`meleeHit`

The attack button (F, gamepad X) strikes: everything with health in the cone in front of the character is hit. Plays the attack animation if the model has one.

**In Unity:** `Melee attack (custom component)`

**Fields:**

- Damage (`damage`): number, default: 25
- Reach (`range`): number, default: 2.2
- Angle (`angle`): number, default: 120
- Time Between Strikes (`cooldown`): number, default: 0.5
- Hits Only Tag (empty = all) (`hitsTag`): string, default: ""

### Projectile

`projectile`

Flies straight ahead (the way the object faces), hits the first object with health and disappears afterwards or after its lifetime. Fire it with the block "create prefab", best at an object that faces the aim.

**In Unity:** `Projectile (custom component)`

**Fields:**

- Speed (m/s) (`speed`): number, default: 14
- Damage (`damage`): number, default: 10
- Lifetime (`lifetime`): number, default: 4
- Hit Radius (`radius`): number, default: 0.6
- Ignores Tag (e.g. the shooter) (`ignoreTag`): string, default: ""
- Effect on Hit (`effect`): options: Sparks, Explosion, Smoke, default: "sparks"

### Pickup

`pickup`

An item to collect. Whoever touches it (or picks it up with "Interact") gets it in the inventory; the object disappears with a sound and a sparkle.

**In Unity:** `Collectible (custom component)`

**Fields:**

- Item (`item`): string, default: "Münze"
- Count (`count`): number, default: 1
- Pick Up (`mode`): options: On touch, With "Interact", default: "touch"
- Reach (`radius`): number, default: 1.2
- Spins (`spin`): boolean, default: true
- Sound (`sound`): string, default: "coin"
- Effect (`effect`): options: Sparkle, Sparks, None, default: "sparkle"

### Talkable

`talkable`

The player can talk to the object with "Interact" (E, gamepad Y). Then the chosen dialog from the Dialog editor opens; the answers start "when dialog answer …" and can give or take items.

**In Unity:** `Dialogue trigger (custom component)`

**Fields:**

- Dialog (`dialog`): asset (dialog), default: none
- Display Name (empty: object name) (`name`): string, default: ""
- Reach (`radius`): number, default: 2.5
- Turns to the Player (`faceUser`): boolean, default: true

### UI Canvas

`uiCanvas`

Shows a UI canvas (from the UI Editor) over the game: HUD, menus, hints. With split screen a canvas can belong to one player. "While the game is paused" is for the pause menu, "by hand" for menus that a button or the block "show UI" opens.

**In Unity:** `Canvas`

**Fields:**

- UI Canvas (`ui`): asset (ui), default: none
- For Player (`player`): options: All players, Player 1, Player 2, default: "all"
- Visible (`visibility`): options: Always, While the game is paused, By hand (block or button), default: "always"
- Sort Order (higher = in front) (`sortOrder`): number, default: 0

### Usable

`usable`

The player can use the object with "Interact" (E, gamepad Y) when standing in front of it. It starts "when I am used" and can send a message; optionally it needs an item (a lever handle, say).

**In Unity:** `Interactable (custom component)`

**Fields:**

- Hint Text (empty = default) (`prompt`): string, default: ""
- Reach (`radius`): number, default: 2.2
- Needs Item (`requires`): string, default: ""
- Use Up the Item (`consume`): boolean, default: false
- Only Once (`once`): boolean, default: false
- Send Message (to everyone) (`message`): string, default: ""

### Door

`door`

A door or gate. It slides, lifts or swings; while it is closed the object’s colliders block the way. With a key item it is locked. Switches, levers and the blocks "open" and "close" operate it, the player with "Interact". The swing pivot is the object’s origin.

**In Unity:** `Door (custom component)`

**Fields:**

- Starts Open (`open`): boolean, default: false
- Style (`style`): options: Slide sideways, Lift up, Swing open, default: "slide"
- Opening Distance (`distance`): number, default: 2.5
- Swing Angle (`angle`): number, default: 100
- Duration (`duration`): number, default: 1
- Key (item) (`key`): string, default: ""
- Use Up the Key (`consumeKey`): boolean, default: false
- Operated With "Interact" (`interact`): boolean, default: true
- Reach (`radius`): number, default: 2.6

### Switch

`switch`

A lever or button. The player flips it with "Interact": a connected door opens or closes, and it can send messages ("when I receive message …"). Use the messages to react to its state.

**In Unity:** `Lever (custom component)`

**Fields:**

- Operates (door or chest) (`target`): object, default: none
- Starts On (`on`): boolean, default: false
- Message When Switched On (`messageOn`): string, default: ""
- Message When Switched Off (`messageOff`): string, default: ""
- Reach (`radius`): number, default: 2

### Chest

`chest`

A chest with contents. "Interact" opens it (with a key if needed) and the contents go into the opener’s inventory. A child object named "Lid" or "Deckel" swings open. Afterwards the chest is empty.

**In Unity:** `Chest (custom component)`

**Fields:**

- Contents (e.g. Key:1, Coin:5) (`contents`): string, default: "Münze:5"
- Key (item) (`key`): string, default: ""
- Use Up the Key (`consumeKey`): boolean, default: false
- Reach (`radius`): number, default: 2.2

### Destructible

`destructible`

The object breaks after some hits (melee, projectiles, "damage …"), with an effect and a sound. Each hit takes away one hit point.

**In Unity:** `Destructible (custom component)`

**Fields:**

- Hits It Takes (`hits`): number, default: 3
- Effect When Destroyed (`effect`): options: Explosion, Smoke, Sparks, Dust, default: "explosion"
- Sound When Destroyed (`sound`): string, default: "explosion"

### Checkpoint

`checkpoint`

When a player comes within the radius the game remembers this place. Whoever is defeated with "Respawn" (Health component) comes back here.

**In Unity:** `Checkpoint (custom component)`

**Fields:**

- Radius (`radius`): number, default: 2.5
- Target Tag (`targetTag`): string, default: "Player"

### Audio Source

`audioSource`

Plays a sound. With "3D Sound" it gets quieter with distance and comes from the direction of the object. Built-in sounds and imported files (WAV, OGG, MP3) work the same.

**In Unity:** `Audio Source`

**Fields:**

- Sound (`sound`): asset (sound), default: none
- Volume (`volume`): number, default: 1
- Pitch (`pitch`): number, default: 1
- Loop (`loop`): boolean, default: false
- Play On Awake (`playOnAwake`): boolean, default: true
- Channel (`bus`): options: Music, Effects, Voices, default: "effects"
- 3D Sound (`spatial`): boolean, default: true
- Full Volume Up To (`minDistance`): number, default: 1
- Silent From (`maxDistance`): number, default: 30

### Audio Listener

`audioListener`

The "ears" of the game: sounds are heard from this object’s position. Without an Audio Listener the camera hears.

**In Unity:** `Audio Listener`

### Light

`light`

Lights the scene. A directional light is the sun and drives the sky.

**In Unity:** `Light`

**Fields:**

- Type (`lightType`): options: Directional, Point, Spot, default: "directional"
- Color (`color`): color, default: "#fff1de"
- Intensity (`intensity`): number, default: 4.6
- Range (`range`): number, default: 10
- Spot Angle (`spotAngle`): number, default: 30
- Cast Shadows (`castShadows`): boolean, default: true

### Block Script

`blockScript`

Runs the blocks of a block script for this object.

**In Unity:** `MonoBehaviour (C# script)`

**Fields:**

- Script (`script`): asset (blockScript), default: none

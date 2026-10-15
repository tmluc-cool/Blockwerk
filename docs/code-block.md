# Code blocks (JavaScript for advanced users)

Blocks are the only source of a script. The **code view** (button `</>` in the block editor) shows the
JavaScript that the blocks turn into, read-only; every line belongs to the block it came from.
For things the blocks cannot do yet, the **code blocks** (palette category "Code") hold your own
JavaScript. The editor never rewrites what you write there.

| Block              | Shape       | Text field holds          |
| ------------------ | ----------- | ------------------------- |
| `code [ … ]`       | stack       | JavaScript statements     |
| `code value [ … ]` | round value | one JavaScript expression |

The code is read when the script is compiled. If it cannot be read (a syntax error), the console
names the block and the reason, and the block is skipped; the rest of the script still runs.

## What is available

The statements of a `code` block run inside the generated script function, between the blocks
above and below it. These names exist:

| Name    | What it is                                                                                                                                                                                                                                                                                                                                         |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `self`  | The object that runs the script (`GameObject`): `name`, `tag`, `layer`, `position` (a three.js `Vector3`, local, in meters), `object3d` (the three.js node), `vars` (values of the script's object variables by variable ID), `worldPosition()`, `move(direction, meters)`, `turn(direction, degrees)`, `destroyed`, `parent`, `children`.         |
| `game`  | The functions the blocks use (`GameApi`, `packages/runtime/src/game/api.ts`): `game.vars` (game variables by ID), `game.time`, `game.keyDown(key)`, `game.find(self, ref)`, `game.sendMessage(self, message, target)`, `game.num(x)`, `game.str(x)`, `game.bool(x)`, the list and dictionary helpers (`game.listAdd(list, item)` …) and many more. |
| `scene` | `scene.find(name)` → the first object with this name or `null`; `scene.findAll(tag?)` → all objects, or the ones with the tag.                                                                                                                                                                                                                     |
| `three` | The 3D library ([three.js](https://threejs.org/)): `three.Vector3`, `three.MathUtils`, `three.Color` …                                                                                                                                                                                                                                             |

Units: meters, seconds, angles in degrees in blocks (radians inside three.js, as usual).
Y points up.

## Waiting

A script is a generator function. Wait with `yield*` (one frame: `yield;`):

```js
self.position.y += 1;
yield * game.wait(0.5); // wait half a second, the game goes on meanwhile
self.position.y -= 1;
```

Code without `yield` runs to its end inside one tick, like any block. Do not write endless loops
without a `yield;` in them: they stop the whole game.

## Values

`code value` takes an expression, for example `self.position.y`, `scene.findAll("Enemy").length`
or `three.MathUtils.clamp(self.position.x, -5, 5)`. Put it into any slot of a block. Numbers and text
convert as everywhere else; lists and dictionaries are plain JavaScript arrays and objects.

## Limits

- The code runs with the same rights as the game. A mistake can stop the game (the editor itself
  keeps working; play mode is isolated from it).
- Each line is trimmed and indented by the block; do not rely on leading spaces inside template
  strings that span lines.
- A script that is in the **code view** is generated again from the blocks every time; the view is
  never a second source.

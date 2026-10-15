import { defineBlock } from '../defineBlock';

/**
 * Code blocks (SPEC 7.9): the way out for advanced users. The text is JavaScript that runs inside
 * the script like any other block, with `self`, `game`, `scene` and `three` (see docs/code-block.md).
 * Blocks are the only source of a script; the editor never rewrites what is written here.
 */

export const runCode = defineBlock({
  id: 'code.run',
  category: 'code',
  shape: 'stack',
  inputs: { code: { type: 'textField', default: '// self.position.y += 1;', multiline: true } },
  text: { de: 'Code {code}', en: 'code {code}' },
  keywords: {
    de: ['javascript', 'skript', 'programmieren', 'fortgeschritten'],
    en: ['javascript', 'script', 'program', 'advanced', 'js'],
  },
  code: { field: 'code', kind: 'statements' },
  compile: (_args, meta) => {
    const body = meta
      .text('code')
      .split('\n')
      .map((line) => `  ${line}`)
      .join('\n');
    return `{\n  const scene = game.scene, three = game.three;\n${body}\n}`;
  },
  docs: {
    de: 'JavaScript für Fortgeschrittene. Verfügbar sind self (dieses Objekt), game (die Spiel-Funktionen der Blöcke), scene (Objekte suchen) und three (die 3D-Bibliothek). Mit yield* game.wait(1) lässt sich warten. Der Code wird nie automatisch umgeschrieben.',
    en: 'JavaScript for advanced users. Available are self (this object), game (the functions the blocks use), scene (find objects) and three (the 3D library). Use yield* game.wait(1) to wait. The code is never rewritten automatically.',
  },
  since: 7,
});

export const codeValue = defineBlock({
  id: 'code.value',
  category: 'code',
  shape: 'reporter',
  output: 'any',
  inputs: { code: { type: 'textField', default: 'self.position.y' } },
  text: { de: 'Code-Wert {code}', en: 'code value {code}' },
  keywords: {
    de: ['javascript', 'ausdruck', 'fortgeschritten'],
    en: ['javascript', 'expression', 'advanced', 'js'],
  },
  code: { field: 'code', kind: 'expression' },
  compile: (_args, meta) => `((scene, three) => (${meta.text('code')}))(game.scene, game.three)`,
  docs: {
    de: 'Ein JavaScript-Ausdruck als Wert, zum Beispiel self.position.y. Verfügbar sind self, game, scene und three.',
    en: 'A JavaScript expression as a value, for example self.position.y. Available are self, game, scene and three.',
  },
  since: 7,
});

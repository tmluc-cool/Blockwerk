import { describe, expect, it } from 'vitest';
import { GameObject, loadScriptModule, ScriptModuleError } from '../src';

describe('GameObject.moveLocal', () => {
  it('moves forward along local +Z', () => {
    const object = new GameObject({ id: 'a', name: 'Cube' });
    object.moveLocal(0, 0, 2);
    expect(object.position.toArray()).toEqual([0, 0, 2]);
  });

  it('respects the object rotation', () => {
    const object = new GameObject({ id: 'a', name: 'Cube' });
    object.object3d.rotation.y = Math.PI / 2;
    object.moveLocal(0, 0, 1);
    expect(object.position.x).toBeCloseTo(1, 6);
    expect(object.position.z).toBeCloseTo(0, 6);
  });
});

describe('loadScriptModule', () => {
  it('returns the scripts of valid generated code', () => {
    const module = loadScriptModule(
      'function* s_1(self, game) { self.moveLocal(0, 0, 1); }\n' +
        'return { scripts: [{ id: "h1", event: { type: "start" }, run: s_1 }] };',
    );
    expect(module.scripts).toHaveLength(1);
    expect(module.scripts[0]?.event.type).toBe('start');
  });

  it('rejects code with the wrong shape', () => {
    expect(() => loadScriptModule('return 42;')).toThrow(ScriptModuleError);
    expect(() => loadScriptModule('return { scripts: [{ id: 1 }] };')).toThrow(ScriptModuleError);
  });
});

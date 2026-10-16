import { describe, expect, it } from 'vitest';
import { checkWorld, WORLD_LIMITS } from '../src';
import type { WorldProposal } from '../src';
import { loadLibrary, smallLibrary } from './library';

const real = loadLibrary();
const small = new Map(smallLibrary().map((entry) => [entry.id, entry]));

function errorsOf(input: unknown, library = small): string[] {
  const result = checkWorld(input, { library });
  if (result.ok) throw new Error('expected errors');
  return [...result.errors];
}

describe('checkWorld', () => {
  it('accepts five houses and a well and fills in names, rotation and scale', () => {
    const objects = [
      ...[0, 1, 2, 3, 4].map((index) => ({
        model: 'town/house',
        position: [index * 8 - 16, 0, 10] as [number, number, number],
        rotationY: 180,
      })),
      { model: 'town/well', name: 'Brunnen', position: [0, 0, 0] as [number, number, number] },
    ];
    const result = checkWorld({ summary: 'Ein kleines Dorf.', objects }, { library: small });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.objects).toHaveLength(6);
    expect(result.objects[0]).toMatchObject({ name: 'House', scale: 1, rotationY: 180 });
    expect(result.objects[5]?.name).toBe('Brunnen');
  });

  it('accepts real library models if the library was built', () => {
    if (!real) return;
    const library = new Map(real.map((entry) => [entry.id, entry]));
    const houses = real
      .filter((entry) => /home|house/.test(entry.id) && entry.category === 'buildings')
      .slice(0, 5);
    const well = real.find((entry) => /well/.test(entry.id));
    expect(houses).toHaveLength(5);
    expect(well).toBeDefined();
    const proposal = {
      objects: [
        { model: well?.id, position: [0, 0, 0] },
        ...houses.map((entry, index) => ({
          model: `library:${entry.id}`,
          position: [
            Math.cos((index / 5) * Math.PI * 2) * 22,
            0,
            Math.sin((index / 5) * Math.PI * 2) * 22,
          ],
        })),
      ],
    };
    const result = checkWorld(proposal, { library });
    expect(result.ok).toBe(true);
  });

  it('refuses a model that is not in the library', () => {
    expect(errorsOf({ objects: [{ model: 'town/castle', position: [0, 0, 0] }] }).join()).toMatch(
      /not in the library/,
    );
    expect(errorsOf({ objects: [{ position: [0, 0, 0] }] }).join()).toMatch(/not in the library/);
  });

  it('refuses broken numbers and out-of-range values', () => {
    const one = (extra: object) => ({
      objects: [{ model: 'town/house', position: [0, 0, 0], ...extra }],
    });
    expect(errorsOf(one({ position: [0, 0] })).join()).toMatch(/three numbers/);
    expect(errorsOf(one({ position: [0, Number.NaN, 0] })).join()).toMatch(/three numbers/);
    expect(errorsOf(one({ position: [9999, 0, 0] })).join()).toMatch(/within/);
    expect(errorsOf(one({ position: [0, 500, 0] })).join()).toMatch(/y must be/);
    expect(errorsOf(one({ scale: 0 })).join()).toMatch(/scale/);
    expect(errorsOf(one({ rotationY: 'left' })).join()).toMatch(/rotationY/);
    expect(errorsOf(one({ tag: 5 })).join()).toMatch(/tag/);
  });

  it('refuses more than 60 objects and empty answers', () => {
    const many = Array.from({ length: WORLD_LIMITS.objects + 1 }, (_, index) => ({
      model: 'town/tree',
      position: [index * 10, 0, 0],
    }));
    expect(errorsOf({ objects: many }).join()).toMatch(/at most 60/);
    expect(errorsOf({ objects: [] }).join()).toMatch(/at least one/);
    expect(errorsOf(null)[0]).toMatch(/not an object/);
  });

  it('asks to move objects that stand inside each other', () => {
    const proposal: WorldProposal = {
      objects: [
        { model: 'town/house', position: [0, 0, 0] },
        { model: 'town/house', position: [1, 0, 0] },
      ],
    };
    expect(errorsOf(proposal).join()).toMatch(/stand inside each other/);
  });

  it('survives garbage without throwing', () => {
    for (const value of [
      undefined,
      3,
      'x',
      [],
      { objects: 'x' },
      { objects: [null, 5, {}] },
      { objects: [{ model: 'town/house', position: 'here' }] },
    ]) {
      expect(() => checkWorld(value, { library: small })).not.toThrow();
      expect(checkWorld(value, { library: small }).ok).toBe(false);
    }
  });
});

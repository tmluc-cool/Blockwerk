import { describe, expect, it } from 'vitest';
import de from '../src/i18n/de.json';
import en from '../src/i18n/en.json';
import { blockTypesOf, TUTORIAL_STEPS } from '../src/tutorial/steps';
import type { TutorialFacts } from '../src/tutorial/steps';

const empty: TutorialFacts = { cubes: [], scripts: [], scriptsOnCubes: [], play: 'stopped' };
const step = (id: string) => {
  const found = TUTORIAL_STEPS.find((item) => item.id === id);
  if (!found?.done) throw new Error(`step ${id} has no condition`);
  return found.done;
};

describe('tutorial steps', () => {
  it('have German and English texts', () => {
    for (const item of TUTORIAL_STEPS) {
      for (const key of [item.title, item.body]) {
        expect(de[key], key).toBeTruthy();
        expect(en[key], key).toBeTruthy();
      }
    }
  });

  it('are finished by what the user does, in order', () => {
    const cube = { id: 'a', position: [0, 0, 0] };
    expect(step('cube')(empty, empty)).toBe(false);
    const withCube = { ...empty, cubes: [cube] };
    expect(step('cube')(withCube, empty)).toBe(true);

    expect(step('move')(withCube, withCube)).toBe(false);
    const moved = { ...withCube, cubes: [{ id: 'a', position: [0, 2, 0] }] };
    expect(step('move')(moved, withCube)).toBe(true);

    const withScript = { ...moved, scripts: [{ id: 's', blocks: [] }] };
    expect(step('scriptAsset')(moved, moved)).toBe(false);
    expect(step('scriptAsset')(withScript, moved)).toBe(true);

    const attached = { ...withScript, scriptsOnCubes: ['s'] };
    expect(step('attach')(withScript, withScript)).toBe(false);
    expect(step('attach')(attached, withScript)).toBe(true);

    const built = {
      ...attached,
      scripts: [{ id: 's', blocks: ['events.everyFrame', 'motion.turn'] }],
    };
    expect(step('blocks')(attached, attached)).toBe(false);
    expect(step('blocks')(built, attached)).toBe(true);

    expect(step('play')(built, built)).toBe(false);
    const playing = { ...built, play: 'playing' as const };
    expect(step('play')(playing, built)).toBe(true);
    expect(step('stop')(playing, playing)).toBe(false);
    expect(step('stop')(built, playing)).toBe(true);
  });

  it('reads block types from a workspace', () => {
    const workspace = {
      blocks: {
        blocks: [
          { type: 'events.everyFrame', next: { block: { type: 'motion.turn', inputs: {} } } },
        ],
      },
    };
    expect(blockTypesOf(workspace).sort()).toEqual(['events.everyFrame', 'motion.turn']);
  });
});

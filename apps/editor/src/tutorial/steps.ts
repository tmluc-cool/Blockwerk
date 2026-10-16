import type { TranslationKey } from '../i18n';

/** What the tutorial can see of the editor: a few facts read from the project, no state of its own. */
export interface TutorialFacts {
  /** Cubes in the scene (objects with a Mesh Renderer of shape "cube") with their positions. */
  readonly cubes: readonly { readonly id: string; readonly position: readonly number[] }[];
  /** Block script assets of the project: ID and the block types their blocks use. */
  readonly scripts: readonly { readonly id: string; readonly blocks: readonly string[] }[];
  /** Script IDs set in Block Script components on cubes. */
  readonly scriptsOnCubes: readonly string[];
  readonly play: 'stopped' | 'playing' | 'paused';
}

/** One step of the tutorial "Your first world in 10 minutes". */
export interface TutorialStep {
  readonly id: string;
  /** CSS selector of the part of the editor to point at, if any. */
  readonly target: string | null;
  readonly title: TranslationKey;
  readonly body: TranslationKey;
  /** Whether the step is done with what the user did; steps without it wait for "Next". */
  readonly done?: (facts: TutorialFacts, start: TutorialFacts) => boolean;
}

const hasBlock = (facts: TutorialFacts, ...types: string[]): boolean =>
  facts.scripts.some(
    (script) =>
      facts.scriptsOnCubes.includes(script.id) &&
      types.every((type) => script.blocks.includes(type)),
  );

/** The steps in order. Each one is finished by doing it; "Next" skips ahead. */
export const TUTORIAL_STEPS: readonly TutorialStep[] = [
  { id: 'welcome', target: null, title: 'tutorial.welcome.title', body: 'tutorial.welcome.body' },
  {
    id: 'cube',
    target: '[data-testid="menu-gameObject"]',
    title: 'tutorial.cube.title',
    body: 'tutorial.cube.body',
    done: (facts, start) => facts.cubes.length > start.cubes.length,
  },
  {
    id: 'move',
    target: '[data-testid="inspector"]',
    title: 'tutorial.move.title',
    body: 'tutorial.move.body',
    done: (facts, start) =>
      facts.cubes.some((cube) => {
        const before = start.cubes.find((item) => item.id === cube.id)?.position;
        return before !== undefined && cube.position.some((value, i) => value !== before[i]);
      }),
  },
  {
    id: 'scriptAsset',
    target: '[data-testid="project"]',
    title: 'tutorial.scriptAsset.title',
    body: 'tutorial.scriptAsset.body',
    done: (facts, start) => facts.scripts.length > start.scripts.length,
  },
  {
    id: 'attach',
    target: '[data-testid="add-component"]',
    title: 'tutorial.attach.title',
    body: 'tutorial.attach.body',
    done: (facts, start) => facts.scriptsOnCubes.length > start.scriptsOnCubes.length,
  },
  {
    id: 'blocks',
    target: '[data-testid="inspector"]',
    title: 'tutorial.blocks.title',
    body: 'tutorial.blocks.body',
    done: (facts) => hasBlock(facts, 'events.everyFrame', 'motion.turn'),
  },
  {
    id: 'play',
    target: '[data-testid="play"]',
    title: 'tutorial.play.title',
    body: 'tutorial.play.body',
    done: (facts) => facts.play === 'playing',
  },
  {
    id: 'stop',
    target: '[data-testid="play"]',
    title: 'tutorial.stop.title',
    body: 'tutorial.stop.body',
    done: (facts) => facts.play === 'stopped',
  },
  { id: 'finish', target: null, title: 'tutorial.finish.title', body: 'tutorial.finish.body' },
];

/** Block types used anywhere in a Blockly workspace JSON. */
export function blockTypesOf(workspace: unknown): string[] {
  const found = new Set<string>();
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) {
      for (const item of value) visit(item);
    } else if (typeof value === 'object' && value !== null) {
      const record = value as Record<string, unknown>;
      if (typeof record['type'] === 'string') found.add(record['type']);
      for (const child of Object.values(record)) visit(child);
    }
  };
  visit(workspace);
  return [...found];
}

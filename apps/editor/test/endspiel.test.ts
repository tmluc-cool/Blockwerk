import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { compileBlockScript } from '@blockwerk/compiler';
import { buildGame } from '@blockwerk/export';
import { readLibraryFolder } from '@blockwerk/export/node';
import { assetDisplayName, loadProject, resolvePrefab } from '@blockwerk/project';
import type { Project, SaveData, SceneData, UiElement } from '@blockwerk/project';
import { NodeFileSystem } from '@blockwerk/project/node';
import {
  Game,
  initNavigation,
  initPhysics,
  loadScriptModule,
  controlRegistry,
  MemorySaveStorage,
  peekHealth,
  peekInventory,
  peekNpcState,
  setTerrainSource,
  TerrainData,
} from '@blockwerk/runtime';
import type { CarryState, GameLogEntry, GameObject, ScriptAsset } from '@blockwerk/runtime';
import { Vector3 } from 'three';
import { beforeAll, describe, expect, it } from 'vitest';
import { checkScene } from '../src/document/sceneCheck';

/**
 * Acceptance of phase 11 without the UI: `examples/endspiel`, the final game (SPEC phase 11):
 * main menu, an open landscape with a village and a day-night cycle, a figure with two abilities,
 * three villagers with dialogs, skeletons that patrol, chase and fight, items and inventory,
 * a second player in split screen, saving and loading, winning and losing.
 */
const root = join(import.meta.dirname, '..', '..', '..');
const folder = join(root, 'examples', 'endspiel');

beforeAll(async () => {
  await initPhysics();
  await initNavigation();
});

function filesOf(directory: string): Record<string, string> {
  const result: Record<string, string> = {};
  const walk = (current: string): void => {
    for (const name of readdirSync(current)) {
      const path = join(current, name);
      if (statSync(path).isDirectory()) walk(path);
      else result[relative(directory, path).split(sep).join('/')] = readFileSync(path, 'utf8');
    }
  };
  walk(directory);
  return result;
}

const sceneNamed = (project: Project, name: string): { id: string; data: SceneData } => {
  const entry = project
    .assetsOfType('scene')
    .find((asset) => assetDisplayName(asset.path) === name);
  if (!entry) throw new Error(`no scene ${name}`);
  return { id: entry.id, data: entry.data };
};

interface LaunchExtras {
  readonly saves?: MemorySaveStorage;
  readonly save?: SaveData;
  readonly log?: GameLogEntry[];
}

/** Starts a game for a scene of the project like the editor does (with carry-over). */
async function launch(
  project: Project,
  name: string,
  carry?: CarryState,
  spawn?: string,
  extras: LaunchExtras = {},
): Promise<Game> {
  const assets = new Map<string, ScriptAsset>();
  for (const entry of project.assetsOfType('blockScript')) {
    const result = compileBlockScript(entry.data.workspace, {
      assetName: assetDisplayName(entry.path),
      variables: entry.data.variables,
    });
    expect(result.diagnostics, entry.path).toEqual([]);
    assets.set(entry.id, {
      assetId: entry.id,
      module: loadScriptModule(result.code),
      variables: entry.data.variables,
      lineToBlock: result.lineToBlock,
      sourceUrl: `test://${entry.id}`,
    });
  }
  setTerrainSource((id) => {
    const bytes = project.assetBytes(id);
    return bytes ? TerrainData.deserialize(bytes) : null;
  });
  const scene = sceneNamed(project, name);
  const game = new Game(scene.data, {
    scripts: (id) => assets.get(id) ?? null,
    dialogs: (id) => project.assetOfType(id, 'dialog')?.data ?? null,
    prefabs: (id) =>
      resolvePrefab(id, (prefab) => project.assetOfType(prefab, 'prefab')?.data) ?? null,
    uis: (id) => project.assetOfType(id, 'ui')?.data ?? null,
    saves: extras.saves ?? new MemorySaveStorage(),
    savedVariables: new Set(
      project
        .assetsOfType('blockScript')
        .flatMap((entry) => entry.data.variables)
        .filter((variable) => variable.scope === 'game' && variable.saved)
        .map((variable) => variable.id),
    ),
    ...(extras.save ? { save: extras.save } : {}),
    ...(extras.log ? { log: (entry: GameLogEntry) => extras.log?.push(entry) } : {}),
    sceneId: scene.id,
    sceneName: name,
    random: () => 0.5,
    ...(carry ? { carry } : {}),
    ...(spawn !== undefined ? { spawn } : {}),
  });
  await game.world.modelsLoaded();
  return game;
}

const run = (game: Game, seconds: number): void => {
  for (let i = 0; i < Math.round(seconds * 60); i++) game.stepTick();
};

const named = (game: Game, name: string): GameObject => {
  const object = [...game.world.allObjects()].find((candidate) => candidate.name === name);
  if (!object) throw new Error(`no object ${name}`);
  return object;
};

function standAt(game: Game, near: string, offset: [number, number, number] = [0, 0, -1.4]): void {
  const target = named(game, near).worldPosition();
  const hero = named(game, 'Ritter');
  hero.setWorldPosition(target.clone().add(new Vector3(...offset)));
  // Facing +z, towards the target (the offsets put the hero south of it).
  hero.object3d.rotation.set(0, 0, 0);
  run(game, 0.15);
}

function press(game: Game, key: string, code: string): void {
  game.input.keyEvent(key, true, code);
  run(game, 0.05);
  game.input.keyEvent(key, false, code);
  run(game, 0.05);
}
const interact = (game: Game): void => press(game, 'e', 'KeyE');

const choose = (game: Game, answer: string): void => {
  const choice = game.dialogView()?.choices.find((item) => item.id === answer);
  if (!choice) throw new Error(`no answer ${answer}: ${JSON.stringify(game.dialogView())}`);
  game.chooseDialogAnswer(choice.index);
  run(game, 0.05);
};

function flattenUi(elements: readonly UiElement[]): UiElement[] {
  return elements.flatMap((element) => [element, ...flattenUi(element.children ?? [])]);
}

/** Talks to a villager: stands next to them and opens the dialog. */
function talkTo(game: Game, name: string): void {
  standAt(game, name);
  interact(game);
  if (!game.talking) {
    const who = named(game, 'Ritter').worldPosition();
    const other = named(game, name).worldPosition();
    throw new Error(
      `${name} does not talk: hero ${who.toArray()} npc ${other.toArray()} hint ${JSON.stringify(game.interactionHint(1))}`,
    );
  }
  expect(game.dialogView()?.speaker).toBe(name);
}

const bag = (game: Game, item: string, who = 'Ritter'): number =>
  peekInventory(named(game, who))?.count(item) ?? 0;

describe('examples/endspiel', { timeout: 300_000 }, () => {
  it('opens without problems, saves without changes and passes the scene check', async () => {
    const project = await loadProject(new NodeFileSystem(folder));
    expect(project.problems).toEqual([]);
    const files = filesOf(folder);
    const changed = [...project.files()]
      .filter(([path, text]) => files[path] !== text)
      .map(([path]) => path);
    expect(changed).toEqual([]);
    for (const name of ['Hauptmenue', 'Land']) {
      const game = await launch(project, name);
      const problems = checkScene(game.world, {
        project,
        displayName: assetDisplayName,
        locale: 'en',
      });
      expect(
        problems.map((problem) => `${problem.code} ${JSON.stringify(problem.params)}`),
        name,
      ).toEqual([]);
      game.dispose();
    }
  });

  it('starts in a main menu; Play leads to the open landscape', async () => {
    const project = await loadProject(new NodeFileSystem(folder));
    expect(project.settings.startScene).toBe(sceneNamed(project, 'Hauptmenue').id);
    const game = await launch(project, 'Hauptmenue');
    run(game, 0.2);
    const buttons = flattenUi(game.uiCanvases()[0]?.ui.elements ?? []).filter(
      (element) => element.type === 'button',
    );
    expect(buttons.map((button) => button.text)).toEqual([
      'Spielen',
      'Einstellungen',
      'Beenden',
      'Laden 1',
      'Laden 2',
      'Laden 3',
    ]);
    const play = buttons.find((button) => button.text === 'Spielen');
    for (const action of play?.actions ?? []) game.runUiAction(action);
    expect(game.takeSceneRequest()?.scene).toBe(sceneNamed(project, 'Land').id);
    game.dispose();
  });

  it('the landscape has terrain, water, a village, forest and a day-night cycle', async () => {
    const project = await loadProject(new NodeFileSystem(folder));
    const game = await launch(project, 'Land');
    run(game, 0.5);
    const types = new Set<string>();
    for (const object of game.world.allObjects()) {
      for (const component of object.components) types.add(component.definition.type);
    }
    expect(types.has('terrain')).toBe(true);
    expect(types.has('water')).toBe(true);
    const names = [...game.world.allObjects()].map((object) => object.name);
    expect(names.filter((name) => name.startsWith('Baum')).length).toBeGreaterThan(100);
    expect(names).toEqual(expect.arrayContaining(['Brunnen', 'tavern-red', 'church-blue']));
    // A day takes four minutes of game time: the clock moves.
    const morning = game.timeOfDay();
    run(game, 30);
    const later = game.timeOfDay();
    expect(later).toBeGreaterThan(morning + 2);
    game.dispose();
  });

  it('the hero is a Character Studio figure with two ability cards and walks on the terrain', async () => {
    const project = await loadProject(new NodeFileSystem(folder));
    const game = await launch(project, 'Land');
    run(game, 1);
    const hero = named(game, 'Ritter');
    const types = hero.components.map((component) => component.definition.type);
    expect(types).toEqual(expect.arrayContaining(['character', 'doubleJump', 'roll']));
    expect(hero.findComponent('character')?.values['model']).toBe(
      'library:kaykit-adventurers/knight',
    );
    // It stands on the ground (the village plateau), not in the air or below.
    const start = hero.worldPosition().clone();
    run(game, 1);
    expect(Math.abs(hero.worldPosition().y - start.y)).toBeLessThan(0.3);
    // Walking forward moves it.
    game.input.keyEvent('w', true, 'KeyW');
    run(game, 1.5);
    game.input.keyEvent('w', false, 'KeyW');
    expect(hero.worldPosition().distanceTo(start)).toBeGreaterThan(2);
    game.dispose();
  });

  it('three villagers have dialogs: the quest giver, the guard and the trader', async () => {
    const project = await loadProject(new NodeFileSystem(folder));
    const game = await launch(project, 'Land');
    run(game, 0.5);
    expect(project.assetsOfType('dialog')).toHaveLength(3);

    talkTo(game, 'Mira');
    choose(game, 'fragen');
    choose(game, 'annehmen');
    game.confirmDialog();
    run(game, 0.1);
    expect(game.vars['esvarquest01']).toBe(1);
    expect(game.vars['esvartask001']).toBe('Hole das Zauberbuch aus der Ruine');

    talkTo(game, 'Bork');
    choose(game, 'trank');
    game.confirmDialog();
    run(game, 0.1);
    expect(bag(game, 'Heiltrank')).toBe(2);
    // He gives the potions only once.
    talkTo(game, 'Bork');
    expect(game.dialogView()?.choices.map((choice) => choice.id)).toEqual(['tschuess']);
    choose(game, 'tschuess');

    // Pip sells a potion for five coins, but not for nothing.
    talkTo(game, 'Pip');
    expect(game.dialogView()?.choices.map((choice) => choice.id)).not.toContain('kaufen');
    choose(game, 'tschuess');
    game.addItem(named(game, 'Ritter'), 'self', 'Münze', 6);
    talkTo(game, 'Pip');
    choose(game, 'kaufen');
    game.confirmDialog();
    run(game, 0.1);
    expect(bag(game, 'Münze')).toBe(1);
    expect(bag(game, 'Heiltrank')).toBe(3);
    game.dispose();
  });

  it('items go into the inventory: coins are collected, a chest gives a potion, H drinks one', async () => {
    const project = await loadProject(new NodeFileSystem(folder));
    const game = await launch(project, 'Land');
    run(game, 0.5);
    const hero = named(game, 'Ritter');
    const coin = named(game, 'Muenze 1').worldPosition().clone();
    hero.setWorldPosition(coin);
    run(game, 0.5);
    expect(bag(game, 'Münze')).toBe(1);
    standAt(game, 'Truhe', [0, 0, -1.5]);
    interact(game);
    expect(bag(game, 'Heiltrank')).toBe(1);
    // Hurt, then drink with H: the life goes up by 40 and the potion is used up.
    game.damageObject(hero, 'self', 60);
    expect(peekHealth(hero)?.current).toBe(40);
    press(game, 'h', 'KeyH');
    expect(peekHealth(hero)?.current).toBe(80);
    expect(bag(game, 'Heiltrank')).toBe(0);
    // Without a potion H does nothing.
    press(game, 'h', 'KeyH');
    expect(peekHealth(hero)?.current).toBe(80);
    game.dispose();
  });

  it('skeletons patrol, chase around obstacles and fight; the hero hits back', async () => {
    const project = await loadProject(new NodeFileSystem(folder));
    const game = await launch(project, 'Land');
    run(game, 0.5);
    const skeleton = named(game, 'Skelett 1');
    expect(peekNpcState(skeleton)?.current).toBe('patrol');
    const start = skeleton.worldPosition().clone();
    run(game, 8);
    expect(skeleton.worldPosition().distanceTo(start)).toBeGreaterThan(1.5);

    // The hero steps into its view cone: it notices and chases, and hurts the hero.
    const hero = named(game, 'Ritter');
    const ahead = new Vector3(0, 0, 7).applyQuaternion(skeleton.object3d.quaternion);
    hero.setWorldPosition(skeleton.worldPosition().clone().add(ahead));
    run(game, 0.4);
    expect(peekNpcState(skeleton)?.current).toBe('chase');
    run(game, 8);
    expect(skeleton.worldPosition().distanceTo(hero.worldPosition())).toBeLessThan(3);
    expect(peekHealth(hero)?.current ?? 100).toBeLessThan(100);

    // The hero strikes with F: the skeleton loses life and is gone after enough hits.
    const before = peekHealth(skeleton)?.current ?? 0;
    hero.setWorldPosition(
      skeleton
        .worldPosition()
        .clone()
        .add(new Vector3(0, 0, -1.2)),
    );
    hero.object3d.lookAt(
      skeleton.worldPosition().x,
      hero.worldPosition().y,
      skeleton.worldPosition().z,
    );
    run(game, 0.1);
    for (let i = 0; i < 6; i++) {
      press(game, 'f', 'KeyF');
      run(game, 0.5);
    }
    const after = peekHealth(skeleton)?.current ?? 0;
    expect(after).toBeLessThan(before);
    game.dispose();
  });

  it('a second player joins with Enter and the screen splits', async () => {
    const project = await loadProject(new NodeFileSystem(folder));
    const log: GameLogEntry[] = [];
    const game = await launch(project, 'Land', undefined, undefined, { log });
    run(game, 0.5);
    expect(game.views().views.map((view) => view.player)).toEqual(['1']);
    press(game, 'Enter', 'Enter');
    run(game, 0.3);
    expect(
      game
        .views()
        .views.map((view) => view.player)
        .sort(),
    ).toEqual(['1', '2']);
    const second = named(game, 'Ritterin');
    expect(second.activeInHierarchy).toBe(true);
    // Player 2 steers with the arrow keys.
    const start = second.worldPosition().clone();
    game.input.keyEvent('ArrowUp', true, 'ArrowUp');
    run(game, 1.5);
    game.input.keyEvent('ArrowUp', false, 'ArrowUp');
    expect(second.worldPosition().distanceTo(start)).toBeGreaterThan(1.5);
    expect(log.filter((entry) => entry.level === 'error')).toEqual([]);
    game.dispose();
  });

  it('wins: the book from the ruin is handed to Mira and the victory screen appears', async () => {
    const project = await loadProject(new NodeFileSystem(folder));
    const game = await launch(project, 'Land');
    run(game, 0.5);
    talkTo(game, 'Mira');
    choose(game, 'fragen');
    choose(game, 'annehmen');
    game.confirmDialog();
    run(game, 0.1);
    // The ruin: the book lies between the skeletons; kill the guards first by setting them aside.
    for (const name of ['Skelett Krieger 1', 'Skelett Krieger 2']) {
      game.damageObject(named(game, name), 'self', 1000);
    }
    run(game, 0.5);
    standAt(game, 'Zauberbuch', [0, -0.9, -1.4]);
    interact(game);
    expect(bag(game, 'Zauberbuch')).toBe(1);
    talkTo(game, 'Mira');
    choose(game, 'abgeben');
    game.confirmDialog();
    run(game, 2);
    expect(bag(game, 'Zauberbuch')).toBe(0);
    expect(bag(game, 'Münze')).toBe(25);
    expect(game.vars['esvarquest01']).toBe(2);
    const shown = game
      .uiCanvases()
      .flatMap((canvas) => flattenUi(canvas.ui.elements))
      .map((element) => element.text);
    expect(shown).toContain('Das Dorf ist gerettet!');
    game.dispose();
  });

  it('loses: when the life is gone the defeat screen appears with restart and main menu', async () => {
    const project = await loadProject(new NodeFileSystem(folder));
    const game = await launch(project, 'Land');
    run(game, 0.5);
    game.damageObject(named(game, 'Ritter'), 'self', 1000);
    run(game, 2);
    const elements = game.uiCanvases().flatMap((canvas) => flattenUi(canvas.ui.elements));
    expect(elements.map((element) => element.text)).toEqual(
      expect.arrayContaining(['Niederlage', 'Neu starten', 'Hauptmenü']),
    );
    game.dispose();
  });

  it('saves and loads with position, inventory and quest progress', async () => {
    const project = await loadProject(new NodeFileSystem(folder));
    const saves = new MemorySaveStorage();
    let game = await launch(project, 'Land', undefined, undefined, { saves });
    run(game, 0.5);
    talkTo(game, 'Mira');
    choose(game, 'fragen');
    choose(game, 'annehmen');
    game.confirmDialog();
    run(game, 0.1);
    game.addItem(named(game, 'Ritter'), 'self', 'Münze', 7);
    standAt(game, 'Brunnen', [0, 0, -3]);
    const spot = named(game, 'Ritter').worldPosition().clone();
    game.saveGame(1);
    expect(game.slotUsed(1)).toBe(true);
    expect(game.slotUsed(2)).toBe(false);
    game.dispose();

    const first = await launch(project, 'Land', undefined, undefined, { saves });
    expect(first.loadGame(1)).toBe(true);
    const request = first.takeSceneRequest();
    expect(request?.scene).toBe(sceneNamed(project, 'Land').id);
    first.dispose();
    game = await launch(project, 'Land', undefined, undefined, { saves, save: request?.save });
    run(game, 0.3);
    expect(game.vars['esvarquest01']).toBe(1);
    expect(game.vars['esvartask001']).toBe('Hole das Zauberbuch aus der Ruine');
    expect(bag(game, 'Münze')).toBe(7);
    expect(named(game, 'Ritter').worldPosition().distanceTo(spot)).toBeLessThan(0.6);
    game.dispose();
  });

  it('feels like a finished game: smooth movement, animation transitions, look and menus (SPEC 1.1)', async () => {
    const project = await loadProject(new NodeFileSystem(folder));
    const game = await launch(project, 'Land');
    run(game, 1.5);
    const hero = named(game, 'Ritter');
    const control = controlRegistry.get(hero);
    if (!control) throw new Error('the hero has no movement control');
    const speedOver = (seconds: number): number => {
      const from = hero.worldPosition().clone();
      run(game, seconds);
      return hero.worldPosition().distanceTo(from) / seconds;
    };

    // 1. The hero speeds up and brakes smoothly: no jump from standing to full speed.
    expect(control.grounded).toBe(true);
    game.input.keyEvent('w', true, 'KeyW');
    const first = speedOver(0.1);
    const later = speedOver(1);
    expect(first).toBeLessThan(later * 0.8);
    expect(later).toBeGreaterThan(2);
    // 3. Walk -> run -> stop: the speed follows without a jump (the animation states that
    // follow the speed are checked on the hero example, `example03.test.ts`).
    game.input.keyEvent('Shift', true, 'ShiftLeft');
    run(game, 1.5);
    expect(control.running).toBe(true);
    expect(control.speed).toBeGreaterThan(5);
    game.input.keyEvent('Shift', false, 'ShiftLeft');
    game.input.keyEvent('w', false, 'KeyW');
    run(game, 0.05);
    expect(control.speed).toBeGreaterThan(0.5);
    run(game, 1.5);
    expect(control.speed).toBeLessThan(0.1);
    // A jump leaves the ground and lands again (double jump and roll are abilities, not needed).
    press(game, ' ', 'Space');
    run(game, 0.15);
    expect(control.grounded).toBe(false);
    run(game, 2);
    expect(control.grounded).toBe(true);

    // 4. Real shadows, sky, fog in the distance, bloom and ambient occlusion on the camera.
    const scene = sceneNamed(project, 'Land').data;
    expect(scene.environment.fog.enabled).toBe(true);
    expect(scene.environment.sky?.dayLength).toBeGreaterThan(0);
    const sun = Object.values(scene.objects).find((object) => object.name === 'Sonne');
    expect(sun?.components.find((c) => c.type === 'light')?.values['lightType']).toBe(
      'directional',
    );
    expect(project.settings.graphicsLevel).toBe('high');
    const camera = Object.values(scene.objects).find((object) => object.name === 'Hauptkamera');
    expect(camera?.components.map((c) => c.type)).toEqual(
      expect.arrayContaining(['camera', 'thirdPersonCamera', 'postProcessing']),
    );

    // 8. Pause menu, settings with graphics level, volumes, mouse and key bindings.
    game.setGamePaused(true);
    expect(game.uiCanvases().length).toBeGreaterThan(1);
    game.setGamePaused(false);
    const settings = flattenUi(
      project.assetsOfType('ui').find((asset) => assetDisplayName(asset.path) === 'Einstellungen')
        ?.data.elements ?? [],
    );
    expect(settings.filter((element) => element.type === 'slider').map((e) => e.setting)).toEqual([
      'masterVolume',
      'musicVolume',
      'effectsVolume',
      'voicesVolume',
      'mouseSensitivity',
    ]);
    expect(settings.some((element) => element.type === 'keybindings')).toBe(true);
    expect(settings.some((element) => element.type === 'dropdown')).toBe(true);
    game.dispose();
  });

  it('exports as a game with credits, the terrain and no problem', async () => {
    const project = await loadProject(new NodeFileSystem(folder));
    const library = await readLibraryFolder(join(root, 'library'));
    const result = await buildGame({ project, library });
    expect(result.problems.filter((problem) => problem.severity === 'error')).toEqual([]);
    const paths = result.files.map((file) => file.path);
    expect(paths).toContain('game/game.json');
    expect(paths).toContain('CREDITS.txt');
    expect(paths.some((path) => path.endsWith('.terrain.bin') || path.includes('terrain'))).toBe(
      true,
    );
  });
});

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { compileBlockScript } from '@blockwerk/compiler';
import { assetDisplayName, loadProject, resolvePrefab } from '@blockwerk/project';
import type { Project, SaveData, SceneData, UiAction, UiElement } from '@blockwerk/project';
import { NodeFileSystem } from '@blockwerk/project/node';
import {
  Game,
  GameSettings,
  initNavigation,
  MemorySaveStorage,
  initPhysics,
  loadScriptModule,
  navAgentRegistry,
  peekHealth,
  peekInventory,
  peekNpcState,
  thingRegistry,
} from '@blockwerk/runtime';
import type { CarryState, GameObject, ScriptAsset } from '@blockwerk/runtime';
import { Vector3 } from 'three';
import { beforeAll, describe, expect, it } from 'vitest';

/** Acceptance of phase 5 without the UI: `examples/05-quest` (SPEC 10, phase 5). */
const folder = join(import.meta.dirname, '..', '..', '..', 'examples', '05-quest');

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

/** Starts a game for a scene of the project like the editor does (with carry-over). */
interface LaunchExtras {
  readonly saves?: MemorySaveStorage;
  readonly save?: SaveData;
  readonly settings?: GameSettings;
}

async function launch(
  project: Project,
  name: string,
  carry?: CarryState,
  spawn?: string,
  extras: LaunchExtras = {},
): Promise<{ game: Game; sceneId: string }> {
  const assets = new Map<string, ScriptAsset>();
  for (const entry of project.assetsOfType('blockScript')) {
    const result = compileBlockScript(entry.data.workspace, {
      assetName: assetDisplayName(entry.path),
      variables: entry.data.variables,
    });
    expect(result.diagnostics).toEqual([]);
    assets.set(entry.id, {
      assetId: entry.id,
      module: loadScriptModule(result.code),
      variables: entry.data.variables,
      lineToBlock: result.lineToBlock,
      sourceUrl: `test://${entry.id}`,
    });
  }
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
    ...(extras.settings ? { settings: extras.settings } : {}),
    ...(extras.save ? { save: extras.save } : {}),
    sceneId: scene.id,
    sceneName: name,
    random: () => 0.5,
    ...(carry ? { carry } : {}),
    ...(spawn !== undefined ? { spawn } : {}),
  });
  return { game, sceneId: scene.id };
}

const run = (game: Game, seconds: number): void => {
  for (let i = 0; i < Math.round(seconds * 60); i++) game.stepTick();
};

const named = (game: Game, name: string): GameObject => {
  const object = [...game.world.allObjects()].find((candidate) => candidate.name === name);
  if (!object) throw new Error(`no object ${name}`);
  return object;
};

/** Puts the player next to an object. */
function standAt(game: Game, near: string, offset: [number, number, number] = [0, 0, -1.4]): void {
  const target = named(game, near).worldPosition();
  const hero = named(game, 'Ritter');
  hero.setWorldPosition(target.clone().add(new Vector3(...offset)));
  run(game, 0.15);
}

/** Presses and releases the Interact key (E). */
function interact(game: Game): void {
  game.input.keyEvent('e', true, 'KeyE');
  run(game, 0.05);
  game.input.keyEvent('e', false, 'KeyE');
  run(game, 0.05);
}

const choose = (game: Game, answer: string): void => {
  const choice = game.dialogView()?.choices.find((item) => item.id === answer);
  if (!choice) throw new Error(`no answer ${answer}: ${JSON.stringify(game.dialogView())}`);
  game.chooseDialogAnswer(choice.index);
  run(game, 0.05);
};

function flattenUi(elements: readonly UiElement[]): UiElement[] {
  return elements.flatMap((element) => [element, ...flattenUi(element.children ?? [])]);
}

/** The actions of the pause menu's button with a text. */
function buttonActions(game: Game, text: string): UiAction[] {
  game.setGamePaused(true);
  const found = game
    .uiCanvases()
    .flatMap((canvas) => flattenUi(canvas.ui.elements))
    .find((element) => element.text === text);
  game.setGamePaused(false);
  if (!found) throw new Error(`no button ${text}`);
  return found.actions ?? [];
}

describe('examples/05-quest', { timeout: 180_000 }, () => {
  it('loads without problems and a save writes nothing', async () => {
    const project = await loadProject(new NodeFileSystem(folder));
    expect(project.problems).toEqual([]);
    const files = filesOf(folder);
    const changed = [...project.files()]
      .filter(([path, text]) => files[path] !== text)
      .map(([path]) => path);
    expect(changed).toEqual([]);
    expect(project.dirty).toBe(false);
  });

  it('has two scenes, a dialog, and two zombie variants of the prefab "Gegner"', async () => {
    const project = await loadProject(new NodeFileSystem(folder));
    expect(project.assetsOfType('scene').map((asset) => assetDisplayName(asset.path))).toEqual(
      expect.arrayContaining(['Dorf', 'Gruft']),
    );
    expect(project.assetsOfType('dialog')).toHaveLength(1);
    const prefabs = project.assetsOfType('prefab');
    const base = prefabs.find((asset) => assetDisplayName(asset.path) === 'Gegner');
    const variants = prefabs.filter((asset) => asset.data.base === base?.id);
    expect(variants.map((asset) => assetDisplayName(asset.path)).sort()).toEqual([
      'Zombie A',
      'Zombie B',
    ]);
    // The zombies in the village are instances of the variants.
    const village = sceneNamed(project, 'Dorf').data;
    const instances = Object.values(village.objects).filter(
      (object) => object.prefab?.overrides !== undefined,
    );
    expect(instances.map((object) => object.name).sort()).toEqual(['Zombie A', 'Zombie B']);
    expect(instances.every((object) => variants.some((v) => v.id === object.prefab?.asset))).toBe(
      true,
    );
    // Every library model of the scenes exists in the library index (when it was built).
    const models = [village, sceneNamed(project, 'Gruft').data].flatMap((scene) =>
      Object.values(scene.objects).flatMap((object) =>
        object.components
          .map((component) => component.values['model'])
          .filter((model): model is string => typeof model === 'string'),
      ),
    );
    try {
      const index = JSON.parse(
        readFileSync(join(import.meta.dirname, '..', '..', '..', 'library', 'index.json'), 'utf8'),
      ) as { entries: { id: string }[] };
      const ids = new Set(index.entries.map((entry) => `library:${entry.id}`));
      expect(models.filter((model) => !ids.has(model))).toEqual([]);
    } catch (error) {
      // No library built (pnpm assets:fetch not run): nothing to compare with.
      if (!(error instanceof Error) || !('code' in error)) throw error;
    }
  });

  it('plays the whole quest: accept, key from the chest, gate, crypt, book, reward', async () => {
    const project = await loadProject(new NodeFileSystem(folder));
    const village = await launch(project, 'Dorf');
    let game = village.game;
    run(game, 0.3);
    const hero = (): GameObject => named(game, 'Ritter');

    // Mira gives the quest in a dialog.
    standAt(game, 'Mira');
    expect(game.interactionHint(1)).toEqual({ kind: 'talk', label: 'Mira' });
    interact(game);
    expect(game.talking).toBe(true);
    expect(game.dialogView()?.speaker).toBe('Mira');
    choose(game, 'fragen');
    choose(game, 'annehmen');
    // The line "danke" has no answers and only continues.
    game.confirmDialog();
    run(game, 0.1);
    expect(game.talking).toBe(false);
    const quest = [...Object.entries(game.vars)].find(([key]) => key === 'questvarstat');
    expect(quest?.[1]).toBe(1);
    expect(game.vars['questvartask']).toBe('Finde den Schlüssel in der Truhe');

    // The key lies in the chest at the well.
    standAt(game, 'Truhe', [0, 0, -1.5]);
    interact(game);
    expect(peekInventory(hero())?.count('Schlüssel')).toBe(1);

    // The gate is locked without the key and opens with it.
    const gate = named(game, 'Tor');
    expect(thingRegistry.get(gate)?.isOpen).toBe(false);
    standAt(game, 'Tor', [0, 0, -2]);
    interact(game);
    expect(thingRegistry.get(gate)?.isOpen).toBe(true);
    expect(peekInventory(hero())?.count('Schlüssel')).toBe(0);

    // Walking into the crypt entrance asks for the crypt scene.
    standAt(game, 'Gruft-Eingang', [0, 0, 0]);
    run(game, 0.5);
    const request = game.takeSceneRequest();
    expect(request?.spawn).toBe('Eingang');
    expect(request?.scene).toBe(sceneNamed(project, 'Gruft').id);
    const carry = game.exportCarry();
    game.dispose();

    // The crypt: the player keeps the state and finds the spell book.
    game = (await launch(project, 'Gruft', carry, request?.spawn)).game;
    run(game, 0.3);
    expect(game.vars['questvarstat']).toBe(1);
    standAt(game, 'Zauberbuch', [0, -0.9, -1.4]);
    interact(game);
    expect(peekInventory(hero())?.count('Zauberbuch')).toBe(1);
    standAt(game, 'Ausgang', [0, -1, 0]);
    run(game, 0.5);
    const back = game.takeSceneRequest();
    expect(back?.scene).toBe(village.sceneId);
    const carryBack = game.exportCarry();
    game.dispose();

    // Back in the village: bring the book to Mira and get the reward.
    game = (await launch(project, 'Dorf', carryBack, back?.spawn)).game;
    run(game, 0.3);
    expect(peekInventory(hero())?.count('Zauberbuch')).toBe(1);
    standAt(game, 'Mira');
    interact(game);
    choose(game, 'abgeben');
    expect(game.dialogView()?.text).toContain('25 Münzen');
    game.confirmDialog();
    run(game, 0.1);
    expect(peekInventory(hero())?.count('Münze')).toBe(25);
    expect(peekInventory(hero())?.count('Zauberbuch')).toBe(0);
    expect(game.vars['questvarstat']).toBe(2);
    game.dispose();
  });

  it('two zombies patrol, spot the player in their view cone and chase around obstacles', async () => {
    const project = await loadProject(new NodeFileSystem(folder));
    const { game } = await launch(project, 'Dorf');
    run(game, 0.5);
    const zombieA = named(game, 'Zombie A');
    const zombieB = named(game, 'Zombie B');
    for (const zombie of [zombieA, zombieB]) {
      expect(navAgentRegistry.get(zombie)).toBeDefined();
      expect(peekNpcState(zombie)?.current).toBe('patrol');
    }
    // They really patrol: after a few seconds both have moved from where they started.
    const startA = zombieA.worldPosition();
    const startB = zombieB.worldPosition();
    run(game, 6);
    expect(zombieA.worldPosition().distanceTo(startA)).toBeGreaterThan(1.5);
    expect(zombieB.worldPosition().distanceTo(startB)).toBeGreaterThan(1.5);
    expect(peekNpcState(zombieA)?.current).toBe('patrol');

    // The player steps into the view cone of Zombie A: it notices and chases.
    const hero = named(game, 'Ritter');
    const ahead = new Vector3(0, 0, 7).applyQuaternion(zombieA.object3d.quaternion);
    hero.setWorldPosition(zombieA.worldPosition().clone().add(ahead));
    run(game, 0.3);
    expect(peekNpcState(zombieA)?.current).toBe('chase');
    // The player runs behind the house; the zombie has to find its way around it.
    const house = named(game, 'home-a-red').worldPosition();
    hero.setWorldPosition(new Vector3(house.x - 5, 0, house.z));
    zombieA.setWorldPosition(new Vector3(house.x + 5, 0, house.z));
    run(game, 15);
    const gap = zombieA.worldPosition().distanceTo(hero.worldPosition());
    expect(gap).toBeLessThan(3);
    // It also hurts the player when it reaches them.
    expect(peekHealth(hero)?.current ?? 100).toBeLessThan(100);
    game.dispose();
  });

  it('zombies wait while a dialog is open and go on afterwards', async () => {
    const project = await loadProject(new NodeFileSystem(folder));
    const { game } = await launch(project, 'Dorf');
    run(game, 0.3);
    standAt(game, 'Mira');
    const zombie = named(game, 'Zombie A');
    const hero = named(game, 'Ritter');
    // The zombie stands 7 m behind the player, looking at them: it notices and starts the chase.
    zombie.setWorldPosition(
      hero
        .worldPosition()
        .clone()
        .add(new Vector3(0, 0, -7)),
    );
    zombie.object3d.rotation.y = 0;
    run(game, 0.5);
    expect(peekNpcState(zombie)?.current).toBe('chase');
    interact(game);
    expect(game.talking).toBe(true);
    const frozen = zombie.worldPosition().clone();
    run(game, 2);
    expect(zombie.worldPosition().distanceTo(frozen)).toBeLessThan(0.01);
    choose(game, 'tschuess');
    expect(game.talking).toBe(false);
    run(game, 1.5);
    expect(zombie.worldPosition().distanceTo(frozen)).toBeGreaterThan(1);
    game.dispose();
  });

  it('the project starts in a main menu with play, settings, quit and the three load slots', async () => {
    const project = await loadProject(new NodeFileSystem(folder));
    expect(project.settings.startScene).toBe(sceneNamed(project, 'Hauptmenue').id);
    const { game } = await launch(project, 'Hauptmenue');
    run(game, 0.2);
    const canvases = game.uiCanvases();
    // The main menu is always there; the settings only after "Settings".
    expect(canvases).toHaveLength(1);
    const buttons = flattenUi(canvases[0]?.ui.elements ?? []).filter(
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
    expect(game.takeSceneRequest()?.scene).toBe(sceneNamed(project, 'Dorf').id);
    const settings = buttons.find((button) => button.text === 'Einstellungen');
    for (const action of settings?.actions ?? []) game.runUiAction(action);
    expect(game.uiCanvases()).toHaveLength(2);
    game.dispose();
  });

  it('the village has a life bar, an inventory display and hints; Esc shows the pause menu', async () => {
    const project = await loadProject(new NodeFileSystem(folder));
    const { game } = await launch(project, 'Dorf');
    run(game, 0.3);
    const hud = game.uiCanvases();
    expect(hud).toHaveLength(1);
    const types = flattenUi(hud[0]?.ui.elements ?? []).map((element) => element.type);
    expect(types).toEqual(expect.arrayContaining(['bar', 'inventory', 'hint', 'dialog', 'text']));
    const bar = flattenUi(hud[0]?.ui.elements ?? []).find((element) => element.type === 'bar');
    const player = named(game, 'Ritter');
    expect(bar?.bind && game.bindingValue(bar.bind, 1)).toEqual({ value: 100, max: 100 });
    game.damageObject(player, 'self', 40);
    expect(bar?.bind && game.bindingValue(bar.bind, 1).value).toBe(60);
    // Pause: the pause menu appears and the game stands still.
    game.setGamePaused(true);
    expect(game.uiCanvases().length).toBe(2);
    const ticks = game.tick;
    game.advance(0.5);
    expect(game.tick).toBe(ticks);
    const resume = flattenUi(game.uiCanvases().at(-1)?.ui.elements ?? []).find(
      (element) => element.text === 'Fortsetzen',
    );
    for (const action of resume?.actions ?? []) game.runUiAction(action);
    expect(game.gamePaused).toBe(false);
    game.dispose();
  });

  it('the settings change graphics level, volumes, mouse sensitivity and the keys', async () => {
    const project = await loadProject(new NodeFileSystem(folder));
    const settings = new GameSettings();
    const { game } = await launch(project, 'Dorf', undefined, undefined, { settings });
    const sliders = flattenUi(
      project.assetsOfType('ui').find((asset) => assetDisplayName(asset.path) === 'Einstellungen')
        ?.data.elements ?? [],
    );
    expect(sliders.filter((element) => element.type === 'slider').map((e) => e.setting)).toEqual([
      'masterVolume',
      'musicVolume',
      'effectsVolume',
      'voicesVolume',
      'mouseSensitivity',
    ]);
    expect(sliders.some((element) => element.type === 'keybindings')).toBe(true);
    expect(sliders.some((element) => element.type === 'dropdown')).toBe(true);
    settings.set('musicVolume', 20);
    settings.set('mouseSensitivity', 2);
    settings.set('graphicsLevel', 'low');
    settings.setBinding(1, 'interact', ['KeyU']);
    expect(game.audio.volume('music')).toBeCloseTo(0.2);
    expect(game.players[1].sensitivity).toBe(2);
    // The new interact key works in the village.
    standAt(game, 'Mira');
    game.input.keyEvent('u', true, 'KeyU');
    run(game, 0.05);
    game.input.keyEvent('u', false, 'KeyU');
    run(game, 0.05);
    expect(game.talking).toBe(true);
    game.dispose();
  });

  it('saves to three slots and loads each back with position, inventory and quest progress', async () => {
    const project = await loadProject(new NodeFileSystem(folder));
    const saves = new MemorySaveStorage();
    let { game } = await launch(project, 'Dorf', undefined, undefined, { saves });
    run(game, 0.3);
    const hero = (): GameObject => named(game, 'Ritter');
    // Slot 1: quest accepted, key in the bag, standing at the chest.
    standAt(game, 'Mira');
    interact(game);
    choose(game, 'fragen');
    choose(game, 'annehmen');
    game.confirmDialog();
    run(game, 0.1);
    standAt(game, 'Truhe', [0, 0, -1.5]);
    interact(game);
    const chestSpot = hero().worldPosition().clone();
    for (const action of buttonActions(game, 'Speichern 1')) game.runUiAction(action);
    expect(saves.read(1)?.vars['questvarstat']).toBe(1);
    // Slot 2: gate open (key used up), standing at the gate, a coin in the bag.
    standAt(game, 'Tor', [0, 0, -2]);
    interact(game);
    game.addItem(hero(), 'self', 'Münze', 7);
    const gateSpot = hero().worldPosition().clone();
    game.saveGame(2);
    // Slot 3 stays empty.
    expect(game.slotUsed(3)).toBe(false);
    game.dispose();

    const check = async (
      slot: number,
      expected: { at: Vector3; key: number; coin: number },
    ): Promise<void> => {
      const first = (await launch(project, 'Dorf', undefined, undefined, { saves })).game;
      first.loadGame(slot);
      const request = first.takeSceneRequest();
      expect(request?.scene).toBe(sceneNamed(project, 'Dorf').id);
      first.dispose();
      game = (await launch(project, 'Dorf', undefined, undefined, { saves, save: request?.save }))
        .game;
      run(game, 0.2);
      expect(game.vars['questvarstat']).toBe(1);
      expect(game.vars['questvartask']).toBe('Finde den Schlüssel in der Truhe');
      expect(peekInventory(hero())?.count('Schlüssel')).toBe(expected.key);
      expect(peekInventory(hero())?.count('Münze')).toBe(expected.coin);
      expect(hero().worldPosition().distanceTo(expected.at)).toBeLessThan(0.6);
      game.dispose();
    };
    await check(1, { at: chestSpot, key: 1, coin: 0 });
    await check(2, { at: gateSpot, key: 0, coin: 7 });
    // An empty slot loads nothing and says so.
    const empty = (await launch(project, 'Dorf', undefined, undefined, { saves })).game;
    expect(empty.loadGame(3)).toBe(false);
    expect(empty.notice?.key).toBe('noSave');
    empty.dispose();
  });
});

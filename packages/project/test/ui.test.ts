import { describe, expect, it } from 'vitest';
import {
  assetTypeOfPath,
  FORMAT_VERSION,
  loadProject,
  MemoryFileSystem,
  Project,
  saveSchema,
  stringifyDeterministic,
  uiSchema,
  variableSchema,
} from '../src';
import type { UiAction, UiData } from '../src';

const ui: UiData = {
  formatVersion: FORMAT_VERSION,
  referenceWidth: 1280,
  referenceHeight: 720,
  elements: [
    {
      id: 'bar',
      name: 'Leben',
      type: 'bar',
      visible: true,
      anchorMin: [0, 0],
      anchorMax: [0, 0],
      pivot: [0, 0],
      offsetMin: [24, 24],
      offsetMax: [264, 48],
      bind: { kind: 'health' },
      color: '#d33',
    },
    {
      id: 'panel',
      name: 'Menü',
      type: 'panel',
      visible: true,
      anchorMin: [0.5, 0.5],
      anchorMax: [0.5, 0.5],
      pivot: [0.5, 0.5],
      offsetMin: [-200, -100],
      offsetMax: [200, 100],
      children: [
        {
          id: 'start',
          name: 'Start',
          type: 'button',
          visible: true,
          anchorMin: [0, 0],
          anchorMax: [1, 0],
          pivot: [0.5, 0],
          offsetMin: [10, 10],
          offsetMax: [-10, 50],
          text: 'Spiel starten',
          actions: [{ type: 'loadScene', scene: 'abcdefghijkl', spawn: '' }, { type: 'resume' }],
        },
      ],
    },
  ],
};

describe('ui assets', () => {
  it('has its own file ending', () => {
    expect(assetTypeOfPath('Assets/UI/Hauptmenü.ui.json')).toBe('ui');
  });

  it('accepts a canvas with nested elements and rejects unknown element types and actions', () => {
    expect(uiSchema.safeParse(ui).success).toBe(true);
    const bad = structuredClone(ui);
    bad.elements = bad.elements.map((item, index) =>
      index === 0 ? ({ ...item, type: 'carousel' } as unknown as typeof item) : item,
    );
    expect(uiSchema.safeParse(bad).success).toBe(false);
    const badAction = structuredClone(ui);
    badAction.elements = badAction.elements.map((item) => ({
      ...item,
      children: item.children?.map((child) => ({
        ...child,
        actions: [{ type: 'format-disk' } as unknown as UiAction],
      })),
    }));
    expect(uiSchema.safeParse(badAction).success).toBe(false);
  });

  it('is saved and loaded without changes, with stable text', async () => {
    const fs = new MemoryFileSystem();
    const project = new Project({ formatVersion: 1, name: 'UI', startScene: null });
    const entry = project.createAsset('ui', 'Assets/UI/Menü.ui.json', ui);
    await project.save(fs);
    const loaded = await loadProject(fs);
    expect(loaded.problems).toEqual([]);
    expect(loaded.assetOfType(entry.id, 'ui')?.data).toEqual(ui);
    const before = [...loaded.files()];
    await loaded.save(fs);
    expect([...loaded.files()]).toEqual(before);
    expect(loaded.dirty).toBe(false);
  });
});

describe('saved variables and save slots', () => {
  it('the "saved" flag is optional, so old variables stay as they are', () => {
    const old = {
      id: 'v',
      name: 'Anzahl',
      type: 'number',
      scope: 'game',
      default: 0,
      inspector: false,
    };
    const parsed = variableSchema.parse(old);
    expect(stringifyDeterministic(parsed)).toBe(stringifyDeterministic(old));
    expect(variableSchema.parse({ ...old, saved: true }).saved).toBe(true);
  });

  it('a save slot holds the scene, the saved variables and the players', () => {
    const save = {
      formatVersion: FORMAT_VERSION,
      slot: 2,
      scene: 'abcdefghijkl',
      sceneName: 'Dorf',
      savedAt: '2026-10-15T08:00:00.000Z',
      vars: { quest: 1, task: 'Finde den Schlüssel' },
      players: [
        {
          position: [1, 0, -4],
          yaw: 90,
          items: { Schlüssel: 1 },
          health: { current: 80, max: 100 },
          stamina: null,
        },
      ],
    };
    expect(saveSchema.parse(save)).toEqual(save);
    expect(saveSchema.safeParse({ ...save, slot: 4 }).success).toBe(false);
  });
});

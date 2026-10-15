import { describe, expect, it } from 'vitest';
import { ANCHOR_PRESETS, applyAnchorPreset, canvasScale, layoutRect } from '../src';

const screen = { x: 0, y: 0, width: 1280, height: 720 };

describe('canvasScale', () => {
  it('scales with the smaller ratio', () => {
    expect(canvasScale(1280, 720, 1280, 720)).toBe(1);
    expect(canvasScale(2560, 1440, 1280, 720)).toBe(2);
    expect(canvasScale(1920, 720, 1280, 720)).toBe(1);
    expect(canvasScale(640, 720, 1280, 720)).toBe(0.5);
  });
});

describe('layoutRect', () => {
  it('a fixed-size element sits at its anchor with the offsets as size', () => {
    const rect = layoutRect(
      screen,
      { anchorMin: [1, 0], anchorMax: [1, 0], offsetMin: [-264, 24], offsetMax: [-24, 48] },
      1,
    );
    expect(rect).toEqual({ x: 1016, y: 24, width: 240, height: 24 });
  });

  it('a stretched element follows the parent and the offsets scale with the screen', () => {
    const wide = { x: 0, y: 0, width: 2560, height: 1440 };
    const rect = layoutRect(
      wide,
      { anchorMin: [0, 0], anchorMax: [1, 1], offsetMin: [10, 10], offsetMax: [-10, -10] },
      2,
    );
    expect(rect).toEqual({ x: 20, y: 20, width: 2520, height: 1400 });
  });

  it('children are placed inside their parent', () => {
    const panel = layoutRect(
      screen,
      {
        anchorMin: [0.5, 0.5],
        anchorMax: [0.5, 0.5],
        offsetMin: [-200, -100],
        offsetMax: [200, 100],
      },
      1,
    );
    expect(panel).toEqual({ x: 440, y: 260, width: 400, height: 200 });
    const button = layoutRect(
      panel,
      { anchorMin: [0, 0], anchorMax: [1, 0], offsetMin: [10, 10], offsetMax: [-10, 50] },
      1,
    );
    expect(button).toEqual({ x: 450, y: 270, width: 380, height: 40 });
  });

  it('never gives a negative size', () => {
    const rect = layoutRect(
      screen,
      { anchorMin: [0, 0], anchorMax: [0, 0], offsetMin: [50, 50], offsetMax: [10, 10] },
      1,
    );
    expect(rect.width).toBe(0);
    expect(rect.height).toBe(0);
  });
});

describe('anchor presets', () => {
  it('keep the size of a fixed element and put it at the right place', () => {
    for (const preset of ANCHOR_PRESETS) {
      const placement = applyAnchorPreset(preset, [200, 60]);
      const rect = layoutRect(screen, placement, 1);
      if (preset === 'topLeft') expect(rect).toEqual({ x: 0, y: 0, width: 200, height: 60 });
      if (preset === 'bottomRight')
        expect(rect).toEqual({ x: 1080, y: 660, width: 200, height: 60 });
      if (preset === 'center') expect(rect).toEqual({ x: 540, y: 330, width: 200, height: 60 });
      if (preset === 'stretch') expect(rect).toEqual(screen);
      if (preset === 'stretchHorizontal') expect(rect.width).toBe(1280);
      if (preset === 'stretchVertical') expect(rect.height).toBe(720);
    }
  });
});

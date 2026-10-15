import type { UiElement } from '@blockwerk/project';

/** A rectangle in pixels; y grows downwards like on screen. */
export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** The part of an element that places it. */
export type UiPlacement = Pick<UiElement, 'anchorMin' | 'anchorMax' | 'offsetMin' | 'offsetMax'>;

/** Factor from reference pixels to screen pixels: the canvas scales with the smaller ratio. */
export function canvasScale(
  width: number,
  height: number,
  referenceWidth: number,
  referenceHeight: number,
): number {
  if (referenceWidth <= 0 || referenceHeight <= 0) return 1;
  return Math.min(width / referenceWidth, height / referenceHeight);
}

/**
 * Where an element is inside its parent (Unity: RectTransform): the anchors pick two points of the
 * parent (0..1), the offsets (reference pixels, times `scale`) move them. When both anchors are the
 * same the element has a fixed size; when they differ it stretches with the parent.
 */
export function layoutRect(parent: Rect, element: UiPlacement, scale: number): Rect {
  const left = parent.x + element.anchorMin[0] * parent.width + element.offsetMin[0] * scale;
  const top = parent.y + element.anchorMin[1] * parent.height + element.offsetMin[1] * scale;
  const right = parent.x + element.anchorMax[0] * parent.width + element.offsetMax[0] * scale;
  const bottom = parent.y + element.anchorMax[1] * parent.height + element.offsetMax[1] * scale;
  return { x: left, y: top, width: Math.max(0, right - left), height: Math.max(0, bottom - top) };
}

/** Anchor presets of the UI editor (Unity's anchor presets). */
export const ANCHOR_PRESETS = [
  'topLeft',
  'topCenter',
  'topRight',
  'middleLeft',
  'center',
  'middleRight',
  'bottomLeft',
  'bottomCenter',
  'bottomRight',
  'stretchHorizontal',
  'stretchVertical',
  'stretch',
] as const;
/** A named anchor preset. */
export type AnchorPreset = (typeof ANCHOR_PRESETS)[number];

/**
 * Places an element on a preset while keeping its size (a stretch preset keeps the distance to the
 * parent's edges instead). `size` is the element's size in reference pixels.
 */
export function applyAnchorPreset(
  preset: AnchorPreset,
  size: readonly [number, number],
): Pick<UiElement, 'anchorMin' | 'anchorMax' | 'pivot' | 'offsetMin' | 'offsetMax'> {
  const [w, h] = size;
  const column = { Left: 0, Center: 0.5, Right: 1 } as const;
  const row = { top: 0, middle: 0.5, bottom: 1 } as const;
  const match = /^(top|middle|bottom)?(Left|Center|Right)?$/.exec(preset);
  if (preset === 'center') return fixed(0.5, 0.5, w, h);
  if (preset === 'stretch') {
    return {
      anchorMin: [0, 0],
      anchorMax: [1, 1],
      pivot: [0.5, 0.5],
      offsetMin: [0, 0],
      offsetMax: [0, 0],
    };
  }
  if (preset === 'stretchHorizontal') {
    return {
      anchorMin: [0, 0.5],
      anchorMax: [1, 0.5],
      pivot: [0.5, 0.5],
      offsetMin: [0, -h / 2],
      offsetMax: [0, h / 2],
    };
  }
  if (preset === 'stretchVertical') {
    return {
      anchorMin: [0.5, 0],
      anchorMax: [0.5, 1],
      pivot: [0.5, 0.5],
      offsetMin: [-w / 2, 0],
      offsetMax: [w / 2, 0],
    };
  }
  const y = row[(match?.[1] ?? 'middle') as keyof typeof row];
  const x = column[(match?.[2] ?? 'Center') as keyof typeof column];
  return fixed(x, y, w, h);
}

/** A fixed-size element at an anchor point, with its pivot on the same point. */
function fixed(
  x: number,
  y: number,
  w: number,
  h: number,
): Pick<UiElement, 'anchorMin' | 'anchorMax' | 'pivot' | 'offsetMin' | 'offsetMax'> {
  return {
    anchorMin: [x, y],
    anchorMax: [x, y],
    pivot: [x, y],
    offsetMin: [-w * x, -h * y],
    offsetMax: [w * (1 - x), h * (1 - y)],
  };
}

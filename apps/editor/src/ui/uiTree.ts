import { applyAnchorPreset } from '@blockwerk/runtime';
import type { AnchorPreset } from '@blockwerk/runtime';
import type { UiElement, UiElementType } from '@blockwerk/project';

/** Finds an element anywhere in the tree. */
export function findElement(elements: readonly UiElement[], id: string): UiElement | null {
  for (const element of elements) {
    if (element.id === id) return element;
    const inner = findElement(element.children ?? [], id);
    if (inner) return inner;
  }
  return null;
}

/** All elements in drawing order with their depth (for the element list). */
export function flattenElements(
  elements: readonly UiElement[],
  depth = 0,
): { element: UiElement; depth: number }[] {
  return elements.flatMap((element) => [
    { element, depth },
    ...flattenElements(element.children ?? [], depth + 1),
  ]);
}

/** A new element ID that no element uses yet. */
export function newElementId(elements: readonly UiElement[]): string {
  const used = new Set(flattenElements(elements).map(({ element }) => element.id));
  for (let n = used.size + 1; ; n++) {
    if (!used.has(`e${n}`)) return `e${n}`;
  }
}

/** Changes one element; every other element stays the same object. */
export function updateElement(
  elements: readonly UiElement[],
  id: string,
  change: (element: UiElement) => UiElement,
): UiElement[] {
  return elements.map((element) => {
    if (element.id === id) return change(element);
    if (!element.children) return element;
    const children = updateElement(element.children, id, change);
    return children.some((child, index) => child !== element.children?.[index])
      ? { ...element, children }
      : element;
  });
}

/** Takes an element out of the tree. */
export function removeElement(elements: readonly UiElement[], id: string): UiElement[] {
  return elements
    .filter((element) => element.id !== id)
    .map((element) =>
      element.children ? { ...element, children: removeElement(element.children, id) } : element,
    );
}

/** Adds an element at the end of the canvas or, if `parent` is given, into that element. */
export function addElement(
  elements: readonly UiElement[],
  element: UiElement,
  parent: string | null = null,
): UiElement[] {
  if (parent === null) return [...elements, element];
  return updateElement(elements, parent, (target) => ({
    ...target,
    children: [...(target.children ?? []), element],
  }));
}

function renumber(element: UiElement, all: readonly UiElement[], taken: Set<string>): UiElement {
  let n = flattenElements(all).length + taken.size + 1;
  while (taken.has(`e${n}`) || findElement(all, `e${n}`)) n++;
  const id = `e${n}`;
  taken.add(id);
  return {
    ...element,
    id,
    ...(element.children
      ? { children: element.children.map((child) => renumber(child, all, taken)) }
      : {}),
  };
}

/** A copy of an element (with new IDs) right after the original, moved a little. */
export function duplicateElement(elements: readonly UiElement[], id: string): UiElement[] {
  const original = findElement(elements, id);
  if (!original) return [...elements];
  const copy = renumber(
    {
      ...original,
      name: original.name,
      offsetMin: [original.offsetMin[0] + 16, original.offsetMin[1] + 16],
      offsetMax: [original.offsetMax[0] + 16, original.offsetMax[1] + 16],
    },
    elements,
    new Set(),
  );
  const insert = (list: readonly UiElement[]): UiElement[] =>
    list.flatMap((element) => {
      if (element.id === id) return [element, copy];
      return [element.children ? { ...element, children: insert(element.children) } : element];
    });
  return insert(elements);
}

/** Moves an element one place earlier (`-1`, drawn further back) or later (`1`) among its siblings. */
export function moveElement(
  elements: readonly UiElement[],
  id: string,
  direction: -1 | 1,
): UiElement[] {
  const index = elements.findIndex((element) => element.id === id);
  if (index >= 0) {
    const target = index + direction;
    if (target < 0 || target >= elements.length) return [...elements];
    const result = [...elements];
    const [moved] = result.splice(index, 1);
    if (moved) result.splice(target, 0, moved);
    return result;
  }
  return elements.map((element) =>
    element.children
      ? { ...element, children: moveElement(element.children, id, direction) }
      : element,
  );
}

/** Size and look a new element starts with. */
const DEFAULTS: Record<UiElementType, { size: [number, number]; more: Partial<UiElement> }> = {
  panel: { size: [300, 200], more: { background: 'rgba(14,16,24,0.9)' } },
  text: { size: [240, 40], more: { text: 'Text', fontSize: 24 } },
  image: { size: [128, 128], more: { image: null } },
  bar: {
    size: [240, 24],
    more: { bind: { kind: 'health' }, color: '#d33', background: 'rgba(0,0,0,0.5)' },
  },
  button: { size: [240, 48], more: { text: 'Button', fontSize: 22, actions: [] } },
  slider: { size: [240, 32], more: { setting: 'musicVolume' } },
  toggle: { size: [240, 32], more: { setting: 'fullscreen', text: 'Toggle', fontSize: 18 } },
  dropdown: { size: [240, 32], more: { setting: 'graphicsLevel', fontSize: 18 } },
  hint: { size: [400, 40], more: { fontSize: 20 } },
  crosshair: { size: [32, 32], more: {} },
  inventory: { size: [240, 200], more: { fontSize: 18, align: 'left' } },
  dialog: { size: [640, 290], more: { fontSize: 18 } },
  keybindings: { size: [660, 150], more: { fontSize: 16 } },
};

/** A new element of a type, centered on the canvas. */
export function createElement(type: UiElementType, id: string, name: string): UiElement {
  const { size, more } = DEFAULTS[type];
  return {
    id,
    name,
    type,
    visible: true,
    ...applyAnchorPreset('center', size),
    ...more,
  };
}

/** Puts an element on an anchor preset, keeping its size. */
export function withPreset(
  element: UiElement,
  preset: AnchorPreset,
  size: [number, number],
): UiElement {
  return { ...element, ...applyAnchorPreset(preset, size) };
}

/** The element's size at the reference resolution if it does not stretch (the offsets' span). */
export function fixedSize(element: UiElement): [number, number] {
  return [
    Math.max(1, element.offsetMax[0] - element.offsetMin[0]),
    Math.max(1, element.offsetMax[1] - element.offsetMin[1]),
  ];
}

/** Moves an element by a distance in reference pixels. */
export function nudge(element: UiElement, dx: number, dy: number): UiElement {
  return {
    ...element,
    offsetMin: [element.offsetMin[0] + dx, element.offsetMin[1] + dy],
    offsetMax: [element.offsetMax[0] + dx, element.offsetMax[1] + dy],
  };
}

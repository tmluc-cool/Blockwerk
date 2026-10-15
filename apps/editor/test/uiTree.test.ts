import { describe, expect, it } from 'vitest';
import type { UiElement } from '@blockwerk/project';
import {
  addElement,
  createElement,
  duplicateElement,
  findElement,
  flattenElements,
  fixedSize,
  moveElement,
  newElementId,
  nudge,
  removeElement,
  updateElement,
  withPreset,
} from '../src/ui/uiTree';

const tree = (): UiElement[] => [
  { ...createElement('panel', 'e1', 'Panel'), children: [createElement('button', 'e2', 'Start')] },
  createElement('text', 'e3', 'Title'),
];

describe('UI element tree', () => {
  it('finds and lists elements with their depth', () => {
    expect(findElement(tree(), 'e2')?.name).toBe('Start');
    expect(findElement(tree(), 'nope')).toBeNull();
    expect(flattenElements(tree()).map(({ element, depth }) => [element.id, depth])).toEqual([
      ['e1', 0],
      ['e2', 1],
      ['e3', 0],
    ]);
  });

  it('changes only the element asked for and keeps the other objects', () => {
    const before = tree();
    const after = updateElement(before, 'e2', (element) => ({ ...element, text: 'Play' }));
    expect(findElement(after, 'e2')?.text).toBe('Play');
    expect(after[1]).toBe(before[1]);
  });

  it('adds, removes and numbers elements', () => {
    let elements = addElement(tree(), createElement('bar', newElementId(tree()), 'Life'));
    expect(elements.map((element) => element.id)).toEqual(['e1', 'e3', 'e4']);
    elements = addElement(elements, createElement('text', 'e5', 'Label'), 'e1');
    expect(findElement(elements, 'e1')?.children?.map((child) => child.id)).toEqual(['e2', 'e5']);
    elements = removeElement(elements, 'e2');
    expect(findElement(elements, 'e2')).toBeNull();
    expect(newElementId(elements)).not.toBe('e5');
  });

  it('a copy gets new IDs for the element and its children, and sits right behind the original', () => {
    const elements = duplicateElement(tree(), 'e1');
    expect(elements.map((element) => element.name)).toEqual(['Panel', 'Panel', 'Title']);
    const ids = flattenElements(elements).map(({ element }) => element.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(elements[1]?.offsetMin[0]).toBe((elements[0]?.offsetMin[0] ?? 0) + 16);
  });

  it('moves an element among its siblings, also inside a parent', () => {
    expect(moveElement(tree(), 'e3', -1).map((element) => element.id)).toEqual(['e3', 'e1']);
    expect(moveElement(tree(), 'e1', -1).map((element) => element.id)).toEqual(['e1', 'e3']);
    const wide = addElement(tree(), createElement('text', 'e9', 'Extra'), 'e1');
    const moved = moveElement(wide, 'e9', -1);
    expect(findElement(moved, 'e1')?.children?.map((child) => child.id)).toEqual(['e9', 'e2']);
  });

  it('presets keep the size; nudging moves both corners', () => {
    const element = createElement('button', 'e1', 'Button');
    const size = fixedSize(element);
    expect(size).toEqual([240, 48]);
    const placed = withPreset(element, 'bottomRight', size);
    expect(placed.anchorMin).toEqual([1, 1]);
    expect(fixedSize(placed)).toEqual(size);
    const moved = nudge(placed, 10, -5);
    expect(moved.offsetMin).toEqual([placed.offsetMin[0] + 10, placed.offsetMin[1] - 5]);
    expect(fixedSize(moved)).toEqual(size);
  });
});

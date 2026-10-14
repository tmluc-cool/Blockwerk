import * as Blockly from 'blockly/core';
import type { FrameReferences } from './frameApi';

/** Values allowed in scene reference fields (same as the compiler accepts). */
const REFERENCE =
  /^(?:self|any|mouse|origin|object:.+|tag:.*|prefab:[a-z0-9]*|builtin:[a-z-]+|audio:[a-z0-9]*)$/;

let references: FrameReferences = {
  objects: [],
  tags: [],
  prefabs: [],
  sounds: [],
  labels: {
    self: 'self',
    any: 'anything',
    mouse: 'mouse',
    origin: 'origin',
    tag: 'Tag',
    missing: '?',
    choosePrefab: '?',
    createVariable: '+',
    noVariables: '',
  },
};

/** Updates the objects and tags offered by all reference fields. */
export function setReferences(next: FrameReferences): void {
  references = next;
}

/** The current references (for the variables flyout labels). */
export function currentReferences(): FrameReferences {
  return references;
}

function labelOf(value: string): string {
  if (value === 'self') return references.labels.self;
  if (value === 'any') return references.labels.any;
  if (value === 'mouse') return references.labels.mouse;
  if (value === 'origin') return references.labels.origin;
  if (value.startsWith('tag:')) return `${references.labels.tag}: ${value.slice(4)}`;
  if (value === 'prefab:') return references.labels.choosePrefab;
  if (value.startsWith('prefab:')) {
    const id = value.slice(7);
    return references.prefabs.find((prefab) => prefab.id === id)?.name ?? references.labels.missing;
  }
  if (value.startsWith('builtin:') || value.startsWith('audio:')) {
    return (
      references.sounds.find((sound) => sound.value === value)?.name ?? references.labels.missing
    );
  }
  if (value.startsWith('object:')) {
    const id = value.slice(7);
    return references.objects.find((object) => object.id === id)?.name ?? references.labels.missing;
  }
  return value;
}

/**
 * Dropdown of scene objects and tags (`field_bw_reference`), filled from the open scene. Values
 * are stable references (`object:<id>`, `tag:<name>`, `self` …), so renaming objects never
 * breaks a script.
 */
export class FieldReference extends Blockly.FieldDropdown {
  constructor(
    private readonly source: string,
    value: string,
  ) {
    super(function (this: Blockly.FieldDropdown): Blockly.MenuOption[] {
      return (this as FieldReference).options();
    });
    this.setValue(value);
  }

  private options(): Blockly.MenuOption[] {
    const values: string[] = [];
    const source = this.source ?? 'object';
    if (source === 'prefab') {
      values.push(...references.prefabs.map((prefab) => `prefab:${prefab.id}`));
      const current = this.getValue();
      if (current && !values.includes(current)) values.push(current);
      if (values.length === 0) values.push('prefab:');
      return values.map((value) => [labelOf(value), value]);
    }
    if (source === 'sound') {
      values.push(...references.sounds.map((sound) => sound.value));
      const current = this.getValue();
      if (current && !values.includes(current)) values.push(current);
      return values.map((value) => [labelOf(value), value]);
    }
    if (source === 'object') values.push('self');
    if (source === 'objectOrMouse') values.push('mouse');
    if (source === 'touchTarget') {
      values.push('any');
      values.push(...references.tags.map((tag) => `tag:${tag}`));
    }
    values.push(...references.objects.map((object) => `object:${object.id}`));
    const current = this.getValue();
    if (current && !values.includes(current)) values.push(current);
    return values.map((value) => [labelOf(value), value]);
  }

  protected override doClassValidation_(newValue?: string): string | null {
    return typeof newValue === 'string' && REFERENCE.test(newValue) ? newValue : null;
  }

  /** Re-reads the label after objects were renamed. */
  refresh(): void {
    const value = this.getValue();
    if (value) this.doValueUpdate_(value);
    this.forceRerender();
  }

  static override fromJson(
    options: Blockly.FieldDropdownFromJsonConfig & { source?: string; text?: string },
  ): FieldReference {
    return new FieldReference(options.source ?? 'object', options.text ?? 'self');
  }
}

let registered = false;

/** Registers the field type with Blockly (once per page). */
export function registerReferenceField(): void {
  if (registered) return;
  registered = true;
  Blockly.fieldRegistry.register('field_bw_reference', FieldReference);
}

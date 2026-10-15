import { MathUtils, Vector3 } from 'three';
import { colliderRegistry } from './colliders';
import { defineComponent } from './defineComponent';
import type { ComponentContext, FieldDefinitions, TickContext, TickStage } from './defineComponent';
import { inventoryOf, parseItems } from '../gameplay/inventory';
import type { InteractionHint } from '../gameplay/interaction';
import { isParticlePreset } from '../effects/presets';
import { nearestWithTag } from '../npc/senses';
import type { GameObject } from '../world/GameObject';

/** What blocks and switches can do with a door, chest or pickup. */
export interface ThingHandle {
  /**
   * Opens (door, chest). Returns `false` if it is locked and the user has no key; `force` (used by
   * blocks) opens it anyway.
   */
  open(user: GameObject | null, force?: boolean): boolean;
  /** Closes (door). */
  close(): void;
  /** Opens a closed thing and closes an open one. */
  toggle(user: GameObject | null, force?: boolean): boolean;
  /** Takes the thing into the user's inventory (pickup). */
  take(user: GameObject): boolean;
  readonly isOpen: boolean;
}

/** Doors, chests and pickups by object. */
export const thingRegistry = new WeakMap<object, ThingHandle>();

const radiusField = (value: number) =>
  ({
    type: 'number',
    default: value,
    min: 0.5,
    step: 0.1,
    unit: 'meters',
    text: { de: 'Reichweite', en: 'Reach' },
  }) as const;

/** Plays a sound and an effect at an object, if they exist. */
function feedback(ctx: ComponentContext, sound: string, effect: string | null): void {
  const at = ctx.object.worldPosition().add(new Vector3(0, 0.5, 0));
  if (sound) ctx.world.audio?.play(sound, { bus: 'effects', position: at });
  if (effect && isParticlePreset(effect)) ctx.world.effects.spawn(effect, at);
}

/** Checks a key requirement; takes the key if it is meant to be used up. */
function unlock(user: GameObject | null, key: string, consume: boolean): boolean {
  if (!key) return true;
  if (!user) return false;
  const items = inventoryOf(user);
  if (!items.has(key)) return false;
  if (consume) items.remove(key, 1);
  return true;
}

/** Registers a thing the Interact action can use. */
function interactable(
  ctx: ComponentContext,
  radius: () => number,
  hint: (user: GameObject) => InteractionHint | null,
  use: (user: GameObject) => void,
): () => void {
  return ctx.world.interactables.register({ object: ctx.object, radius, hint, use });
}

// ------------------------------------------------------------------------------------ pickup

const pickupFields = {
  item: { type: 'string', default: 'Münze', text: { de: 'Gegenstand', en: 'Item' } },
  count: {
    type: 'number',
    default: 1,
    min: 1,
    step: 1,
    text: { de: 'Anzahl', en: 'Count' },
  },
  mode: {
    type: 'enum',
    default: 'touch',
    options: [
      { value: 'touch', text: { de: 'Beim Berühren', en: 'On touch' } },
      { value: 'interact', text: { de: 'Mit „Benutzen“', en: 'With "Interact"' } },
    ],
    text: { de: 'Aufheben', en: 'Pick Up' },
  },
  radius: radiusField(1.2),
  spin: { type: 'boolean', default: true, text: { de: 'Dreht sich', en: 'Spins' } },
  sound: { type: 'string', default: 'coin', text: { de: 'Klang', en: 'Sound' } },
  effect: {
    type: 'enum',
    default: 'sparkle',
    options: [
      { value: 'sparkle', text: { de: 'Glitzer', en: 'Sparkle' } },
      { value: 'sparks', text: { de: 'Funken', en: 'Sparks' } },
      { value: 'none', text: { de: 'Keiner', en: 'None' } },
    ],
    text: { de: 'Effekt', en: 'Effect' },
  },
} as const satisfies FieldDefinitions;

/** Pickup (SPEC 8.13): an item lying around that goes into the player's inventory. */
export const pickup = defineComponent({
  type: 'pickup',
  category: 'gameplay',
  unique: true,
  unity: 'Collectible (custom component)',
  text: { de: 'Aufhebbar', en: 'Pickup' },
  docs: {
    de: 'Ein Gegenstand zum Einsammeln. Wer ihn berührt (oder mit „Benutzen“ aufhebt), bekommt ihn ins Inventar; das Objekt verschwindet mit Klang und Glitzern.',
    en: 'An item to collect. Whoever touches it (or picks it up with "Interact") gets it in the inventory; the object disappears with a sound and a sparkle.',
  },
  keywords: {
    de: ['münze', 'schlüssel', 'einsammeln', 'item'],
    en: ['coin', 'key', 'collect', 'item', 'loot'],
  },
  fields: pickupFields,
  create(ctx, initial) {
    let values = initial;
    const { object, world } = ctx;
    const take = (user: GameObject): boolean => {
      if (object.destroyed) return false;
      inventoryOf(user).add(values.item, values.count);
      feedback(ctx, values.sound, values.effect === 'none' ? null : values.effect);
      world.objectEvents.emit(object, 'thing', { what: 'picked' });
      world.destroyRequests.add(object);
      return true;
    };
    thingRegistry.set(object, {
      open: (user) => (user ? take(user) : false),
      close() {},
      toggle: (user) => (user ? take(user) : false),
      take,
      isOpen: false,
    });
    const unregister = interactable(
      ctx,
      () => values.radius,
      () => (values.mode === 'interact' ? { kind: 'pickup', label: values.item } : null),
      take,
    );
    return {
      tick(stage: TickStage, context: TickContext) {
        if (stage === 'animate' && values.spin) {
          object.object3d.rotation.y += MathUtils.degToRad(90) * context.dt;
        }
        if (stage !== 'control' || values.mode !== 'touch') return;
        const here = object.worldPosition();
        const user = nearestWithTag(world, 'Player', here);
        if (!user) return;
        const there = user.worldPosition();
        if (Math.hypot(there.x - here.x, there.z - here.z) <= values.radius) take(user);
      },
      apply(next) {
        values = next;
      },
      destroy() {
        unregister();
        thingRegistry.delete(object);
      },
    };
  },
});

// ------------------------------------------------------------------------------------ usable

const usableFields = {
  prompt: {
    type: 'string',
    default: '',
    text: { de: 'Hinweis-Text (leer = Standard)', en: 'Hint Text (empty = default)' },
  },
  radius: radiusField(2.2),
  requires: { type: 'string', default: '', text: { de: 'Braucht Gegenstand', en: 'Needs Item' } },
  consume: {
    type: 'boolean',
    default: false,
    text: { de: 'Gegenstand verbrauchen', en: 'Use Up the Item' },
  },
  once: { type: 'boolean', default: false, text: { de: 'Nur einmal', en: 'Only Once' } },
  message: {
    type: 'string',
    default: '',
    text: { de: 'Nachricht senden (an alle)', en: 'Send Message (to everyone)' },
  },
} as const satisfies FieldDefinitions;

/** Usable (SPEC 8.13): something the player can use with the Interact action. */
export const usable = defineComponent({
  type: 'usable',
  category: 'gameplay',
  unique: true,
  unity: 'Interactable (custom component)',
  text: { de: 'Benutzbar', en: 'Usable' },
  docs: {
    de: 'Der Spieler kann das Objekt mit „Benutzen“ (E, Gamepad Y) auslösen, wenn er davorsteht. Es startet „Wenn ich benutzt werde“ und kann eine Nachricht senden; auf Wunsch braucht es einen Gegenstand (zum Beispiel einen Hebelgriff).',
    en: 'The player can use the object with "Interact" (E, gamepad Y) when standing in front of it. It starts "when I am used" and can send a message; optionally it needs an item (a lever handle, say).',
  },
  keywords: {
    de: ['interagieren', 'hebel', 'knopf', 'schalter'],
    en: ['interact', 'lever', 'button', 'use'],
  },
  fields: usableFields,
  create(ctx, initial) {
    let values = initial;
    const { object, world } = ctx;
    let used = false;
    const unregister = interactable(
      ctx,
      () => values.radius,
      () => {
        if (values.once && used) return null;
        return values.prompt
          ? { kind: 'custom', label: values.prompt }
          : { kind: 'use', label: object.name };
      },
      (user) => {
        if (!unlock(user, values.requires, values.consume)) {
          world.objectEvents.emit(object, 'thing', { what: 'locked' });
          return;
        }
        used = true;
        world.objectEvents.emit(object, 'thing', { what: 'used' });
        if (values.message) world.messages.send(values.message, { kind: 'all' }, object);
        feedback(ctx, 'click', null);
      },
    );
    return {
      apply(next) {
        values = next;
      },
      destroy() {
        unregister();
      },
    };
  },
});

// ------------------------------------------------------------------------------------ door

const doorFields = {
  open: { type: 'boolean', default: false, text: { de: 'Anfangs offen', en: 'Starts Open' } },
  style: {
    type: 'enum',
    default: 'slide',
    options: [
      { value: 'slide', text: { de: 'Zur Seite schieben', en: 'Slide sideways' } },
      { value: 'lift', text: { de: 'Hochziehen', en: 'Lift up' } },
      { value: 'swing', text: { de: 'Aufschwingen', en: 'Swing open' } },
    ],
    text: { de: 'Art', en: 'Style' },
  },
  distance: {
    type: 'number',
    default: 2.5,
    min: 0.1,
    step: 0.1,
    unit: 'meters',
    text: { de: 'Weg beim Öffnen', en: 'Opening Distance' },
  },
  angle: {
    type: 'number',
    default: 100,
    min: 10,
    max: 170,
    step: 5,
    unit: 'degrees',
    text: { de: 'Winkel beim Aufschwingen', en: 'Swing Angle' },
  },
  duration: {
    type: 'number',
    default: 1,
    min: 0.05,
    step: 0.1,
    unit: 'seconds',
    text: { de: 'Dauer', en: 'Duration' },
  },
  key: { type: 'string', default: '', text: { de: 'Schlüssel (Gegenstand)', en: 'Key (item)' } },
  consumeKey: {
    type: 'boolean',
    default: false,
    text: { de: 'Schlüssel verbrauchen', en: 'Use Up the Key' },
  },
  interact: {
    type: 'boolean',
    default: true,
    text: { de: 'Mit „Benutzen“ bedienbar', en: 'Operated With "Interact"' },
  },
  radius: radiusField(2.6),
} as const satisfies FieldDefinitions;

/** Door (SPEC 8.13): opens and closes, optionally locked with a key item. */
export const door = defineComponent({
  type: 'door',
  category: 'gameplay',
  unique: true,
  unity: 'Door (custom component)',
  text: { de: 'Tür', en: 'Door' },
  docs: {
    de: 'Eine Tür oder ein Tor. Es wird verschoben, hochgezogen oder aufgeschwungen; solange es zu ist, sperren die Collider des Objekts den Weg. Mit einem Schlüssel-Gegenstand ist es verschlossen. Schalter, Hebel und die Blöcke „öffne“ und „schliesse“ bedienen es, der Spieler mit „Benutzen“. Der Drehpunkt beim Aufschwingen ist der Ursprung des Objekts.',
    en: 'A door or gate. It slides, lifts or swings; while it is closed the object’s colliders block the way. With a key item it is locked. Switches, levers and the blocks "open" and "close" operate it, the player with "Interact". The swing pivot is the object’s origin.',
  },
  keywords: {
    de: ['tor', 'gatter', 'verschlossen', 'schlüssel'],
    en: ['gate', 'locked', 'key', 'portcullis'],
  },
  fields: doorFields,
  create(ctx, initial) {
    let values = initial;
    const { object, world } = ctx;
    let progress = values.open ? 1 : 0;
    let target = progress;
    let shown = 0;
    const apply = (to: number): void => {
      const delta = to - shown;
      shown = to;
      if (delta === 0) return;
      if (values.style === 'swing') {
        object.object3d.rotation.y += MathUtils.degToRad(values.angle) * delta;
      } else if (values.style === 'lift') {
        object.object3d.position.y += values.distance * delta;
      } else {
        object.moveLocal(values.distance * delta, 0, 0);
      }
    };
    apply(progress);
    const setColliders = (enabled: boolean): void => {
      for (const state of colliderRegistry.get(object) ?? []) {
        if (state.enabled === enabled) continue;
        state.enabled = enabled;
        state.version += 1;
      }
    };
    setColliders(progress === 0);
    const handle: ThingHandle = {
      open(user, force = false) {
        if (target === 1) return true;
        if (!force && !unlock(user, values.key, values.consumeKey)) {
          world.objectEvents.emit(object, 'thing', { what: 'locked' });
          return false;
        }
        target = 1;
        feedback(ctx, 'click', null);
        world.objectEvents.emit(object, 'thing', { what: 'opened' });
        return true;
      },
      close() {
        if (target === 0) return;
        target = 0;
        world.objectEvents.emit(object, 'thing', { what: 'closed' });
      },
      toggle(user, force = false) {
        if (target === 1) {
          this.close();
          return true;
        }
        return this.open(user, force);
      },
      take: () => false,
      get isOpen() {
        return target === 1;
      },
    };
    thingRegistry.set(object, handle);
    const unregister = interactable(
      ctx,
      () => values.radius,
      (user) => {
        if (!values.interact) return null;
        if (target === 0 && values.key && !inventoryOf(user).has(values.key)) {
          return { kind: 'locked', label: values.key };
        }
        return { kind: target === 1 ? 'close' : 'open', label: object.name };
      },
      (user) => {
        handle.toggle(user);
      },
    );
    return {
      tick(stage: TickStage, context: TickContext) {
        if (stage !== 'control' || progress === target) return;
        const step = context.dt / Math.max(0.05, values.duration);
        progress =
          target > progress ? Math.min(target, progress + step) : Math.max(target, progress - step);
        apply(progress);
        // The way is free as soon as the door starts moving and blocked again only when shut.
        setColliders(progress <= 0);
      },
      apply(next) {
        values = next;
      },
      destroy() {
        unregister();
        thingRegistry.delete(object);
      },
    };
  },
});

// ------------------------------------------------------------------------------------ switch

const switchFields = {
  target: {
    type: 'object',
    default: null,
    text: { de: 'Bedient (Tür oder Truhe)', en: 'Operates (door or chest)' },
  },
  on: { type: 'boolean', default: false, text: { de: 'Anfangs an', en: 'Starts On' } },
  messageOn: {
    type: 'string',
    default: '',
    text: { de: 'Nachricht beim Einschalten', en: 'Message When Switched On' },
  },
  messageOff: {
    type: 'string',
    default: '',
    text: { de: 'Nachricht beim Ausschalten', en: 'Message When Switched Off' },
  },
  radius: radiusField(2),
} as const satisfies FieldDefinitions;

/** Switch (SPEC 8.15): a lever or button that operates a door or chest and can send messages. */
export const switchComponent = defineComponent({
  type: 'switch',
  category: 'gameplay',
  unique: true,
  unity: 'Lever (custom component)',
  text: { de: 'Schalter', en: 'Switch' },
  docs: {
    de: 'Ein Hebel oder Knopf. Mit „Benutzen“ schaltet der Spieler ihn um: eine verbundene Tür öffnet oder schließt sich, und er kann Nachrichten senden („Wenn ich Nachricht … empfange“). Der Zustand ist als Block „ist Schalter an?“ nicht nötig – benutze die Nachrichten.',
    en: 'A lever or button. The player flips it with "Interact": a connected door opens or closes, and it can send messages ("when I receive message …"). Use the messages to react to its state.',
  },
  keywords: {
    de: ['hebel', 'knopf', 'druckplatte'],
    en: ['lever', 'button', 'pressure plate', 'toggle'],
  },
  fields: switchFields,
  create(ctx, initial) {
    let values = initial;
    const { object, world } = ctx;
    let on = values.on;
    const flip = (user: GameObject | null): void => {
      on = !on;
      const other = values.target ? world.getObject(values.target) : undefined;
      const thing = other ? thingRegistry.get(other) : undefined;
      if (thing) {
        if (on) thing.open(user);
        else thing.close();
      }
      const message = on ? values.messageOn : values.messageOff;
      if (message) world.messages.send(message, { kind: 'all' }, object);
      world.objectEvents.emit(object, 'thing', { what: on ? 'switchedOn' : 'switchedOff' });
      feedback(ctx, 'click', null);
      // The lever visibly tips over.
      object.object3d.rotation.z = MathUtils.degToRad(on ? 35 : -35);
    };
    const unregister = interactable(
      ctx,
      () => values.radius,
      () => ({ kind: 'use', label: object.name }),
      flip,
    );
    thingRegistry.set(object, {
      open: (user) => {
        if (!on) flip(user);
        return true;
      },
      close: () => {
        if (on) flip(null);
      },
      toggle: (user) => {
        flip(user);
        return true;
      },
      take: () => false,
      get isOpen() {
        return on;
      },
    });
    return {
      apply(next) {
        values = next;
      },
      destroy() {
        unregister();
        thingRegistry.delete(object);
      },
    };
  },
});

// ------------------------------------------------------------------------------------ chest

const chestFields = {
  contents: {
    type: 'string',
    default: 'Münze:5',
    text: { de: 'Inhalt (z. B. Schlüssel:1, Münze:5)', en: 'Contents (e.g. Key:1, Coin:5)' },
  },
  key: { type: 'string', default: '', text: { de: 'Schlüssel (Gegenstand)', en: 'Key (item)' } },
  consumeKey: {
    type: 'boolean',
    default: false,
    text: { de: 'Schlüssel verbrauchen', en: 'Use Up the Key' },
  },
  radius: radiusField(2.2),
} as const satisfies FieldDefinitions;

/** Chest (SPEC 8.13): opens once and gives its contents to whoever opened it. */
export const chest = defineComponent({
  type: 'chest',
  category: 'gameplay',
  unique: true,
  unity: 'Chest (custom component)',
  text: { de: 'Truhe', en: 'Chest' },
  docs: {
    de: 'Eine Truhe mit Inhalt. Mit „Benutzen“ geht sie auf (falls nötig, mit Schlüssel) und der Inhalt wandert ins Inventar des Öffners. Ein Kind-Objekt namens „Deckel“ oder „Lid“ klappt dabei auf. Danach ist die Truhe leer.',
    en: 'A chest with contents. "Interact" opens it (with a key if needed) and the contents go into the opener’s inventory. A child object named "Lid" or "Deckel" swings open. Afterwards the chest is empty.',
  },
  keywords: { de: ['schatz', 'kiste', 'beute'], en: ['treasure', 'loot', 'box'] },
  fields: chestFields,
  create(ctx, initial) {
    let values = initial;
    const { object, world } = ctx;
    let opened = false;
    const open = (user: GameObject | null, force = false): boolean => {
      if (opened) return true;
      if (!force && !unlock(user, values.key, values.consumeKey)) {
        world.objectEvents.emit(object, 'thing', { what: 'locked' });
        return false;
      }
      opened = true;
      if (user) {
        const items = inventoryOf(user);
        for (const [name, count] of parseItems(values.contents)) items.add(name, count);
      }
      const lid = object.children.find((child) => /lid|deckel/i.test(child.name));
      if (lid) lid.object3d.rotation.x = MathUtils.degToRad(-100);
      feedback(ctx, 'win', 'sparkle');
      world.objectEvents.emit(object, 'thing', { what: 'opened' });
      return true;
    };
    thingRegistry.set(object, {
      open,
      close() {},
      toggle: open,
      take: () => false,
      get isOpen() {
        return opened;
      },
    });
    const unregister = interactable(
      ctx,
      () => values.radius,
      (user) => {
        if (opened) return null;
        if (values.key && !inventoryOf(user).has(values.key)) {
          return { kind: 'locked', label: values.key };
        }
        return { kind: 'open', label: object.name };
      },
      open,
    );
    return {
      apply(next) {
        values = next;
      },
      destroy() {
        unregister();
        thingRegistry.delete(object);
      },
    };
  },
});

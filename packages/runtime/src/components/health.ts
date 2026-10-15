import { Vector3 } from 'three';
import { defineComponent } from './defineComponent';
import type { FieldDefinitions, TickContext, TickStage } from './defineComponent';
import { healthOf } from '../gameplay/health';
import { isParticlePreset } from '../effects/presets';
import { nearestWithTag } from '../npc/senses';

const healthFields = {
  max: {
    type: 'number',
    default: 100,
    min: 1,
    step: 5,
    text: { de: 'Maximale Lebenspunkte', en: 'Max Health' },
  },
  invulnerable: {
    type: 'number',
    default: 0.4,
    min: 0,
    step: 0.1,
    unit: 'seconds',
    text: { de: 'Unverwundbar nach Treffer', en: 'Invulnerable After a Hit' },
  },
  onDeath: {
    type: 'enum',
    default: 'destroy',
    options: [
      { value: 'destroy', text: { de: 'Objekt zerstören', en: 'Destroy the object' } },
      { value: 'respawn', text: { de: 'Wiederbeleben', en: 'Respawn' } },
      { value: 'nothing', text: { de: 'Nichts (nur Ereignis)', en: 'Nothing (event only)' } },
    ],
    text: { de: 'Bei Tod', en: 'On Death' },
  },
  respawnDelay: {
    type: 'number',
    default: 2,
    min: 0,
    step: 0.5,
    unit: 'seconds',
    text: { de: 'Wiederbelebung nach', en: 'Respawn After' },
  },
} as const satisfies FieldDefinitions;

/**
 * Health (SPEC 8.15, Unity: a health script): hit points, damage and healing through blocks and
 * attacks, and what happens at zero. Raises the events "I am hurt" and "I am defeated".
 */
export const health = defineComponent({
  type: 'health',
  category: 'gameplay',
  unique: true,
  unity: 'Health (custom component)',
  text: { de: 'Lebenspunkte', en: 'Health' },
  docs: {
    de: 'Lebenspunkte für Spieler, Gegner und Dinge, die kaputtgehen. Angriffe, Geschosse und der Block „füge … Schaden zu“ ziehen sie ab, „heile“ gibt welche zurück. Nach einem Treffer ist das Objekt kurz unverwundbar. Bei null: zerstören, wiederbeleben (am letzten Checkpoint) oder nur das Ereignis „Wenn ich besiegt werde“ auslösen.',
    en: 'Hit points for players, enemies and things that break. Attacks, projectiles and the block "damage … " take them away, "heal" gives some back. After a hit the object is briefly invulnerable. At zero: destroy, respawn (at the last checkpoint) or just raise the event "when I am defeated".',
  },
  keywords: {
    de: ['leben', 'herzen', 'schaden', 'tod', 'hp'],
    en: ['hp', 'hearts', 'damage', 'death', 'life'],
  },
  fields: healthFields,
  create({ object, world }, initial) {
    let values = initial;
    const state = healthOf(object);
    state.max = values.max;
    state.current = values.max;
    state.invulnerableTime = values.invulnerable;
    const start = object.worldPosition();
    let respawnIn = -1;
    const effect = (name: string, at: Vector3): void => {
      if (isParticlePreset(name)) world.effects.spawn(name, at);
    };
    return {
      tick(stage: TickStage, context: TickContext) {
        if (stage !== 'animate') return;
        state.advance(context.dt);
        for (const event of state.takeEvents()) {
          const at = object.worldPosition().add(new Vector3(0, 1, 0));
          if (event.type === 'hurt') {
            effect('sparks', at);
            world.audio?.play('hurt', { bus: 'effects', position: at });
            world.objectEvents.emit(object, 'health', { phase: 'hurt' });
          } else {
            effect('smoke', at);
            world.objectEvents.emit(object, 'health', { phase: 'died' });
            if (values.onDeath === 'destroy') world.destroyRequests.add(object);
            else if (values.onDeath === 'respawn') respawnIn = values.respawnDelay;
          }
        }
        if (respawnIn >= 0) {
          respawnIn -= context.dt;
          if (respawnIn <= 0) {
            respawnIn = -1;
            object.setWorldPosition(world.checkpoint ?? start);
            context.physics?.setVelocity(object, new Vector3());
            state.revive();
          }
        }
      },
      apply(next) {
        values = next;
        state.max = next.max;
        state.current = Math.min(state.current, next.max);
        state.invulnerableTime = next.invulnerable;
      },
      destroy() {},
    };
  },
});

const destructibleFields = {
  hits: {
    type: 'number',
    default: 3,
    min: 1,
    step: 1,
    text: { de: 'Hält Treffer aus', en: 'Hits It Takes' },
  },
  effect: {
    type: 'enum',
    default: 'explosion',
    options: [
      { value: 'explosion', text: { de: 'Explosion', en: 'Explosion' } },
      { value: 'smoke', text: { de: 'Rauch', en: 'Smoke' } },
      { value: 'sparks', text: { de: 'Funken', en: 'Sparks' } },
      { value: 'dust', text: { de: 'Staub', en: 'Dust' } },
    ],
    text: { de: 'Effekt beim Zerstören', en: 'Effect When Destroyed' },
  },
  sound: {
    type: 'string',
    default: 'explosion',
    text: { de: 'Klang beim Zerstören', en: 'Sound When Destroyed' },
  },
} as const satisfies FieldDefinitions;

/** Destructible (SPEC 8.15): a crate or barrel that breaks after some hits. */
export const destructible = defineComponent({
  type: 'destructible',
  category: 'gameplay',
  unique: true,
  unity: 'Destructible (custom component)',
  text: { de: 'Zerstörbar', en: 'Destructible' },
  docs: {
    de: 'Das Objekt geht nach einigen Treffern (Nahkampf, Geschosse, „füge … Schaden zu“) kaputt, mit Effekt und Klang. Jeder Treffer zieht einen Lebenspunkt ab.',
    en: 'The object breaks after some hits (melee, projectiles, "damage …"), with an effect and a sound. Each hit takes away one hit point.',
  },
  keywords: {
    de: ['kiste', 'fass', 'kaputt', 'zerbrechen'],
    en: ['crate', 'barrel', 'break', 'smash'],
  },
  fields: destructibleFields,
  create({ object, world }, initial) {
    let values = initial;
    const state = healthOf(object);
    state.max = values.hits;
    state.current = values.hits;
    state.invulnerableTime = 0.15;
    return {
      tick(stage: TickStage, context: TickContext) {
        if (stage !== 'animate') return;
        state.advance(context.dt);
        for (const event of state.takeEvents()) {
          if (event.type !== 'died') continue;
          const at = object.worldPosition().add(new Vector3(0, 0.5, 0));
          if (isParticlePreset(values.effect)) world.effects.spawn(values.effect, at);
          if (values.sound) world.audio?.play(values.sound, { bus: 'effects', position: at });
          world.objectEvents.emit(object, 'health', { phase: 'died' });
          world.destroyRequests.add(object);
        }
      },
      apply(next) {
        values = next;
        state.max = next.hits;
        state.current = Math.min(state.current, next.hits);
      },
      destroy() {},
    };
  },
});

const checkpointFields = {
  radius: {
    type: 'number',
    default: 2.5,
    min: 0.5,
    step: 0.5,
    unit: 'meters',
    text: { de: 'Radius', en: 'Radius' },
  },
  targetTag: {
    type: 'string',
    default: 'Player',
    text: { de: 'Ziel-Tag', en: 'Target Tag' },
  },
} as const satisfies FieldDefinitions;

/** Checkpoint (SPEC 8.15): a place where defeated players come back. */
export const checkpoint = defineComponent({
  type: 'checkpoint',
  category: 'gameplay',
  unique: true,
  unity: 'Checkpoint (custom component)',
  text: { de: 'Checkpoint', en: 'Checkpoint' },
  docs: {
    de: 'Wenn ein Spieler in den Radius kommt, merkt sich das Spiel diese Stelle. Wer mit „Wiederbeleben“ (Komponente Lebenspunkte) besiegt wird, kommt hier zurück.',
    en: 'When a player comes within the radius the game remembers this place. Whoever is defeated with "Respawn" (Health component) comes back here.',
  },
  keywords: {
    de: ['speicherpunkt', 'wiederbeleben', 'respawn'],
    en: ['respawn', 'save point', 'spawn'],
  },
  fields: checkpointFields,
  create({ object, world }, initial) {
    let values = initial;
    let inside = false;
    return {
      tick(stage: TickStage) {
        if (stage !== 'control') return;
        const here = object.worldPosition();
        const near = nearestWithTag(world, values.targetTag, here);
        const there = near?.worldPosition();
        const within = !!there && Math.hypot(there.x - here.x, there.z - here.z) <= values.radius;
        if (!within) {
          inside = false;
          return;
        }
        // Entering the radius makes this the checkpoint (a later one replaces it).
        if (inside) return;
        inside = true;
        world.checkpoint = here.clone();
        world.effects.spawn('sparkle', here);
        world.audio?.play('coin', { bus: 'effects', position: here });
      },
      apply(next) {
        values = next;
      },
      destroy() {},
    };
  },
});

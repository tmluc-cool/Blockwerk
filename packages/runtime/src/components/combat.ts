import { Vector3 } from 'three';
import { controlRegistry } from './controls';
import { defineComponent } from './defineComponent';
import type { FieldDefinitions, TickContext, TickStage } from './defineComponent';
import { hitscan, playAttack, strike } from '../gameplay/combat';
import { peekHealth } from '../gameplay/health';
import { isParticlePreset } from '../effects/presets';
import { npcStateOf } from '../npc/state';
import { angleToPoint, flatDistance, nearestWithTag } from '../npc/senses';

// ------------------------------------------------------------------------------------ melee hit

const meleeFields = {
  damage: {
    type: 'number',
    default: 25,
    min: 0,
    step: 1,
    text: { de: 'Schaden', en: 'Damage' },
  },
  range: {
    type: 'number',
    default: 2.2,
    min: 0.5,
    step: 0.1,
    unit: 'meters',
    text: { de: 'Reichweite', en: 'Reach' },
  },
  angle: {
    type: 'number',
    default: 120,
    min: 10,
    max: 360,
    step: 5,
    unit: 'degrees',
    text: { de: 'Winkel', en: 'Angle' },
  },
  cooldown: {
    type: 'number',
    default: 0.5,
    min: 0,
    step: 0.1,
    unit: 'seconds',
    text: { de: 'Pause zwischen Schlägen', en: 'Time Between Strikes' },
  },
  hitsTag: {
    type: 'string',
    default: '',
    text: { de: 'Trifft nur Tag (leer = alle)', en: 'Hits Only Tag (empty = all)' },
  },
} as const satisfies FieldDefinitions;

/** Melee Hit (SPEC 8.15): the player's attack button hits what is in front. */
export const meleeHit = defineComponent({
  type: 'meleeHit',
  category: 'gameplay',
  unique: true,
  unity: 'Melee attack (custom component)',
  text: { de: 'Nahkampf-Treffer', en: 'Melee Hit' },
  docs: {
    de: 'Die Angriffstaste (F, Gamepad X) schlägt zu: Alles mit Lebenspunkten im Kegel vor der Figur wird getroffen. Spielt die Angriffs-Animation, wenn das Modell eine hat.',
    en: 'The attack button (F, gamepad X) strikes: everything with health in the cone in front of the character is hit. Plays the attack animation if the model has one.',
  },
  keywords: {
    de: ['schwert', 'schlagen', 'angriff', 'kampf'],
    en: ['sword', 'hit', 'attack', 'combat', 'melee'],
  },
  fields: meleeFields,
  create({ object, world }, initial) {
    let values = initial;
    let cooldown = 0;
    return {
      tick(stage: TickStage, context: TickContext) {
        if (stage !== 'control') return;
        cooldown = Math.max(0, cooldown - context.dt);
        const control = controlRegistry.get(object);
        const player = control && control.mode !== 'agent' ? control.player : 1;
        if (cooldown > 0 || !context.input(player).wasPressed('attack')) return;
        cooldown = values.cooldown;
        playAttack(object);
        world.audio?.play('whoosh', { bus: 'effects', position: object.worldPosition() });
        strike(world, object, {
          damage: values.damage,
          range: values.range,
          angle: values.angle,
          tag: values.hitsTag,
        });
      },
      apply(next) {
        values = next;
      },
      destroy() {},
    };
  },
});

// ------------------------------------------------------------------------------------ attack

const attackFields = {
  mode: {
    type: 'enum',
    default: 'melee',
    options: [
      { value: 'melee', text: { de: 'Nahkampf', en: 'Melee' } },
      { value: 'ranged', text: { de: 'Fernkampf', en: 'Ranged' } },
    ],
    text: { de: 'Art', en: 'Mode' },
  },
  targetTag: { type: 'string', default: 'Player', text: { de: 'Ziel-Tag', en: 'Target Tag' } },
  range: {
    type: 'number',
    default: 1.9,
    min: 0.5,
    step: 0.1,
    unit: 'meters',
    text: { de: 'Reichweite', en: 'Reach' },
  },
  damage: { type: 'number', default: 10, min: 0, step: 1, text: { de: 'Schaden', en: 'Damage' } },
  cooldown: {
    type: 'number',
    default: 1.2,
    min: 0.1,
    step: 0.1,
    unit: 'seconds',
    text: { de: 'Pause zwischen Angriffen', en: 'Time Between Attacks' },
  },
  windup: {
    type: 'number',
    default: 0.35,
    min: 0,
    step: 0.05,
    unit: 'seconds',
    text: { de: 'Ausholen', en: 'Wind-Up' },
  },
  activeInState: {
    type: 'string',
    default: 'chase',
    text: { de: 'Aktiv im Zustand', en: 'Active in State' },
  },
} as const satisfies FieldDefinitions;

/** Attack (SPEC 8.8): an NPC hits its target when it is close enough (or shoots it from afar). */
export const attack = defineComponent({
  type: 'attack',
  category: 'gameplay',
  unique: true,
  unity: 'Enemy attack (custom component)',
  text: { de: 'Angreifen', en: 'Attack' },
  docs: {
    de: 'Der NPC greift das nächste Objekt mit dem Ziel-Tag an, sobald es in Reichweite ist: Er dreht sich hin, holt kurz aus (spielt die Angriffs-Animation) und trifft, wenn das Ziel dann noch da ist. Nahkampf trifft im Kegel vor ihm, Fernkampf trifft aus der Ferne, wenn nichts im Weg ist. Läuft nur im Zustand „chase“ (anpassbar).',
    en: 'The NPC attacks the nearest object with the target tag as soon as it is in reach: it turns, winds up briefly (plays the attack animation) and hits if the target is still there. Melee hits in the cone in front of it, ranged hits from afar when nothing is in the way. It runs only in the state "chase" (adjustable).',
  },
  keywords: {
    de: ['gegner', 'zombie', 'biss', 'schuss', 'kampf'],
    en: ['enemy', 'zombie', 'bite', 'shoot', 'combat'],
  },
  fields: attackFields,
  create({ object, world }, initial) {
    let values = initial;
    const state = npcStateOf(object);
    let cooldown = 0;
    let windup = -1;
    return {
      tick(stage: TickStage, context: TickContext) {
        if (stage !== 'control') return;
        cooldown = Math.max(0, cooldown - context.dt);
        if (!state.isActive(values.activeInState)) {
          windup = -1;
          return;
        }
        const here = object.worldPosition();
        const target = nearestWithTag(world, values.targetTag, here, object);
        const health = target ? peekHealth(target) : undefined;
        if (!target || (health && health.dead)) {
          windup = -1;
          return;
        }
        const there = target.worldPosition();
        const distance = flatDistance(here, there);
        if (windup < 0) {
          if (cooldown > 0 || distance > values.range) return;
          if (values.mode === 'melee' && angleToPoint(object, there) > 75) {
            object.lookAtPoint(there);
            return;
          }
          windup = values.windup;
          object.lookAtPoint(there);
          playAttack(object);
          return;
        }
        windup -= context.dt;
        if (windup > 0) return;
        windup = -1;
        cooldown = values.cooldown;
        if (values.mode === 'melee') {
          strike(world, object, {
            damage: values.damage,
            range: values.range * 1.3,
            angle: 150,
            tag: values.targetTag,
          });
        } else if (distance <= values.range * 1.3) {
          hitscan(world, context.physics, object, target, values.damage);
        }
      },
      apply(next) {
        values = next;
      },
      destroy() {},
    };
  },
});

// ------------------------------------------------------------------------------------ projectile

const projectileFields = {
  speed: {
    type: 'number',
    default: 14,
    min: 0.1,
    step: 0.5,
    unit: 'meters',
    text: { de: 'Tempo (m/s)', en: 'Speed (m/s)' },
  },
  damage: { type: 'number', default: 10, min: 0, step: 1, text: { de: 'Schaden', en: 'Damage' } },
  lifetime: {
    type: 'number',
    default: 4,
    min: 0.1,
    step: 0.5,
    unit: 'seconds',
    text: { de: 'Lebensdauer', en: 'Lifetime' },
  },
  radius: {
    type: 'number',
    default: 0.6,
    min: 0.1,
    step: 0.1,
    unit: 'meters',
    text: { de: 'Trefferradius', en: 'Hit Radius' },
  },
  ignoreTag: {
    type: 'string',
    default: '',
    text: { de: 'Ignoriert Tag (z. B. den Schützen)', en: 'Ignores Tag (e.g. the shooter)' },
  },
  effect: {
    type: 'enum',
    default: 'sparks',
    options: [
      { value: 'sparks', text: { de: 'Funken', en: 'Sparks' } },
      { value: 'explosion', text: { de: 'Explosion', en: 'Explosion' } },
      { value: 'smoke', text: { de: 'Rauch', en: 'Smoke' } },
    ],
    text: { de: 'Effekt beim Treffer', en: 'Effect on Hit' },
  },
} as const satisfies FieldDefinitions;

/** Projectile (SPEC 8.15): flies straight ahead and hurts the first thing with health it meets. */
export const projectile = defineComponent({
  type: 'projectile',
  category: 'gameplay',
  unique: true,
  unity: 'Projectile (custom component)',
  text: { de: 'Geschoss', en: 'Projectile' },
  docs: {
    de: 'Fliegt geradeaus (in Blickrichtung des Objekts), trifft das erste Objekt mit Lebenspunkten und verschwindet danach oder nach der Lebensdauer. Mit dem Block „erzeuge Prefab“ abfeuern, am besten bei einem Objekt, das in die Zielrichtung schaut.',
    en: 'Flies straight ahead (the way the object faces), hits the first object with health and disappears afterwards or after its lifetime. Fire it with the block "create prefab", best at an object that faces the aim.',
  },
  keywords: {
    de: ['pfeil', 'kugel', 'schuss', 'fernkampf'],
    en: ['arrow', 'bullet', 'shot', 'ranged', 'fireball'],
  },
  fields: projectileFields,
  create({ object, world }, initial) {
    let values = initial;
    let age = 0;
    const step = new Vector3();
    return {
      tick(stage: TickStage, context: TickContext) {
        if (stage !== 'character') return;
        age += context.dt;
        if (age >= values.lifetime) {
          world.destroyRequests.add(object);
          return;
        }
        object.moveLocal(0, 0, values.speed * context.dt);
        const here = object.worldPosition(step);
        for (const other of world.allObjects()) {
          if (other === object || !other.activeInHierarchy) continue;
          if (values.ignoreTag && other.tag === values.ignoreTag) continue;
          const health = peekHealth(other);
          if (!health || health.dead) continue;
          const there = other.worldPosition();
          if (Math.hypot(there.x - here.x, there.z - here.z) > values.radius) continue;
          if (here.y < there.y - 0.3 || here.y > there.y + 2.2) continue;
          health.damage(values.damage, object);
          if (isParticlePreset(values.effect)) world.effects.spawn(values.effect, here);
          world.audio?.play('hit', { bus: 'effects', position: here });
          world.destroyRequests.add(object);
          return;
        }
      },
      apply(next) {
        values = next;
      },
      destroy() {},
    };
  },
});

import type { LocalizedText } from '../text';

/** Standard animation states (SPEC 8.7); controls and blocks use these names. */
export const ANIMATION_STATES = [
  'idle',
  'walk',
  'run',
  'jump',
  'fall',
  'land',
  'crouch',
  'crouchWalk',
  'attack',
  'hit',
  'death',
  'wave',
  'cheer',
  'interact',
  'roll',
  'block',
  'sit',
] as const;

/** A standard animation state. */
export type AnimationState = (typeof ANIMATION_STATES)[number];

/** Names of the states in the editor and in blocks. */
export const ANIMATION_STATE_TEXT: Readonly<Record<AnimationState, LocalizedText>> = {
  idle: { de: 'Stehen', en: 'Idle' },
  walk: { de: 'Gehen', en: 'Walk' },
  run: { de: 'Rennen', en: 'Run' },
  jump: { de: 'Springen', en: 'Jump' },
  fall: { de: 'Fallen', en: 'Fall' },
  land: { de: 'Landen', en: 'Land' },
  crouch: { de: 'Ducken', en: 'Crouch' },
  crouchWalk: { de: 'Geduckt gehen', en: 'Crouch Walk' },
  attack: { de: 'Angreifen', en: 'Attack' },
  hit: { de: 'Treffer', en: 'Hit' },
  death: { de: 'Sterben', en: 'Death' },
  wave: { de: 'Winken', en: 'Wave' },
  cheer: { de: 'Jubeln', en: 'Cheer' },
  interact: { de: 'Benutzen', en: 'Interact' },
  roll: { de: 'Rollen', en: 'Roll' },
  block: { de: 'Abwehren', en: 'Block' },
  sit: { de: 'Sitzen', en: 'Sit' },
};

/** States whose clips loop; the others play once. */
export const LOOPING_STATES: ReadonlySet<AnimationState> = new Set([
  'idle',
  'walk',
  'run',
  'fall',
  'crouch',
  'crouchWalk',
  'block',
  'sit',
]);

/**
 * Clip name patterns per state, best first. A clip matches when it matches the pattern and not
 * the exclusion; among equally good matches the shortest name wins (e.g. `Idle` over `Idle_B`).
 */
const PATTERNS: Readonly<Record<AnimationState, readonly RegExp[]>> = {
  idle: [/^(unarmed_)?idle(_?a)?$/i, /idle|stand(ing)?$|breath/i],
  walk: [/^walk(ing)?(_?a)?$/i, /walk/i],
  run: [/^run(ning)?(_?a)?$/i, /run|sprint|jog/i],
  jump: [/jump_?(start|up|begin)|^jump$/i, /jump/i],
  fall: [/fall|jump_?(idle|loop|air)|in_?air|airborne/i],
  land: [/land/i],
  crouch: [/crouch(_?idle)?$|^duck|sneak_?idle/i, /crouch/i],
  crouchWalk: [/crouch_?(walk|move|fwd|forward)|sneak(_?walk)?$/i],
  attack: [/^attack/i, /melee_?attack|punch|slash|sword/i, /attack|shoot/i],
  hit: [/^hit|hit_?react/i, /hit|hurt|damage/i],
  death: [/^(death|die|dying)(_?a)?$/i, /death|die|dying/i],
  wave: [/wave|greet|hello/i],
  cheer: [/cheer|victory|celebrat/i],
  interact: [/^interact/i, /interact|use_?item|pick_?up/i],
  roll: [/^roll/i, /dodge_?forward|^dodge|roll/i],
  block: [/^block(ing)?$/i, /block/i],
  sit: [/sit_?(chair|floor)?_?idle|^sit(ting)?$/i, /sit/i],
};

/** Words that make a clip a bad match for a state (e.g. `Jump_Idle` is not standing). */
const EXCLUDE: Partial<Readonly<Record<AnimationState, RegExp>>> = {
  idle: /jump|lie|sit|crouch|fall|block|ranged|melee|aim|pose/i,
  walk: /back|strafe|crouch|sneak/i,
  run: /back|strafe|crouch/i,
  jump: /land|idle|loop|fall|attack|chop/i,
  attack: /block|aim|reload/i,
  hit: /block/i,
  death: /pose/i,
  block: /attack|hit/i,
  sit: /down|stand|pose/i,
};

/**
 * Assigns animation clips to the standard states by their names. `overrides` (from the model's
 * import settings) win over the automatic choice; a state without a match is left out.
 */
export function matchClips(
  clipNames: readonly string[],
  overrides: Readonly<Record<string, string>> = {},
): Map<AnimationState, string> {
  const result = new Map<AnimationState, string>();
  for (const state of ANIMATION_STATES) {
    const chosen = overrides[state];
    if (chosen !== undefined) {
      if (clipNames.includes(chosen)) result.set(state, chosen);
      continue;
    }
    const exclude = EXCLUDE[state];
    for (const pattern of PATTERNS[state]) {
      const matches = clipNames
        .filter((name) => pattern.test(name) && !(exclude?.test(name) ?? false))
        .sort((a, b) => a.length - b.length || a.localeCompare(b));
      if (matches[0]) {
        result.set(state, matches[0]);
        break;
      }
    }
  }
  return result;
}

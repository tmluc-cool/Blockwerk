import { AnimationMixer, LoopOnce, LoopRepeat } from 'three';
import type { AnimationAction } from 'three';
import {
  ANIMATION_STATES,
  ANIMATION_STATE_TEXT,
  LOOPING_STATES,
  matchClips,
} from '../animation/states';
import type { AnimationState } from '../animation/states';
import type { GameObject } from '../world/GameObject';
import { controlRegistry } from './controls';
import type { ControlState } from './controls';
import { defineComponent } from './defineComponent';
import { renderedModels } from './meshRenderer';
import type { RenderedModel } from './meshRenderer';

/** What blocks can do with an animator. */
export interface AnimatorHandle {
  /**
   * Plays a standard state (`wave`) or a clip by name. `once` returns to the automatic states
   * when the clip ends. Returns `false` if the model has no such animation.
   */
  play(name: string, options?: { once?: boolean; fade?: number }): boolean;
  /** Stops a clip started with {@link play} and returns to the automatic states. */
  stop(): void;
  /** Playback speed factor (1 = normal). */
  speed: number;
  /** The main animation playing now: a state name, or the clip name for other clips. */
  readonly current: string | null;
  /** Clip names of the model (empty while it loads). */
  readonly clips: readonly string[];
  /** Called when a clip started with `once` has finished. */
  onFinished: ((name: string) => void) | null;
  /** Animation events since the last call (blocks "when animation … started / finished"). */
  takeEvents(): { name: string; phase: 'started' | 'finished' }[];
}

/** Animators by object. */
export const animatorRegistry = new WeakMap<object, AnimatorHandle>();

/** The model the animator moves: the object's own, else the first one among its children. */
function findModel(object: GameObject): RenderedModel | null {
  const own = renderedModels.get(object);
  if (own) return own;
  for (const child of object.children) {
    const found = findModel(child);
    if (found) return found;
  }
  return null;
}

/** The control that drives the animator: on the object or one of its parents. */
function findControl(object: GameObject): ControlState | null {
  for (let current: GameObject | null = object; current; current = current.parent) {
    const control = controlRegistry.get(current);
    if (control) return control;
  }
  return null;
}

interface Target {
  weight: number;
  timeScale: number;
}

/**
 * Animator, simplified (SPEC 8.7): plays the animations of the model on this object. Control
 * components choose the standard states by themselves (idle, walk, run, jump, fall, land,
 * crouch) with smooth cross-fades and a walk/run speed that matches the movement, so the feet do
 * not slide. Blocks play other animations such as waving.
 */
export const animator = defineComponent({
  type: 'animator',
  category: 'rendering',
  unique: true,
  unity: 'Animator',
  text: { de: 'Animator', en: 'Animator' },
  docs: {
    de: 'Spielt die Animationen des Modells. Mit einer Steuerungs-Komponente wählt er Stehen, Gehen, Rennen, Springen, Fallen, Landen und Ducken selbst und blendet weich über.',
    en: 'Plays the animations of the model. With a controller component it picks idle, walk, run, jump, fall, land and crouch by itself and blends smoothly.',
  },
  keywords: { de: ['animation', 'bewegung', 'figur'], en: ['animation', 'character', 'skeleton'] },
  fields: {
    useControls: {
      type: 'boolean',
      default: true,
      text: { de: 'Von Steuerung gesteuert', en: 'Driven by Controller' },
    },
    defaultState: {
      type: 'enum',
      default: 'idle',
      options: ANIMATION_STATES.map((value) => ({ value, text: ANIMATION_STATE_TEXT[value] })),
      text: { de: 'Standard-Animation', en: 'Default State' },
    },
    crossFade: {
      type: 'number',
      default: 0.2,
      min: 0,
      step: 0.05,
      unit: 'seconds',
      text: { de: 'Überblendzeit', en: 'Transition Duration' },
    },
    speed: {
      type: 'number',
      default: 1,
      min: 0,
      step: 0.1,
      text: { de: 'Geschwindigkeit', en: 'Speed' },
    },
    walkClipSpeed: {
      type: 'number',
      default: 2.2,
      min: 0.1,
      step: 0.1,
      group: 'advanced',
      text: { de: 'Tempo der Geh-Animation (m/s)', en: 'Walk Animation Speed' },
    },
    runClipSpeed: {
      type: 'number',
      default: 5.5,
      min: 0.1,
      step: 0.1,
      group: 'advanced',
      text: { de: 'Tempo der Renn-Animation (m/s)', en: 'Run Animation Speed' },
    },
  },
  create({ object }) {
    let values = {
      useControls: true,
      defaultState: 'idle',
      crossFade: 0.2,
      speed: 1,
      walkClipSpeed: 2.2,
      runClipSpeed: 5.5,
    };
    let bound: RenderedModel | null = null;
    let mixer: AnimationMixer | null = null;
    const actions = new Map<string, AnimationAction>();
    const weights = new Map<AnimationAction, number>();
    let states = new Map<AnimationState, string>();
    let manual: { clip: string; name: string; once: boolean; fade: number } | null = null;
    let current: string | null = null;
    let events: { name: string; phase: 'started' | 'finished' }[] = [];
    let airTicks = 0;
    let lastAir = 0;

    const clipOf = (name: string): string | null => {
      const state = states.get(name as AnimationState);
      if (state) return state;
      return actions.has(name) ? name : null;
    };
    const unbind = (): void => {
      mixer?.stopAllAction();
      if (mixer && bound) mixer.uncacheRoot(bound.root);
      mixer = null;
      bound = null;
      actions.clear();
      weights.clear();
    };
    const bind = (model: RenderedModel): void => {
      unbind();
      bound = model;
      const created = new AnimationMixer(model.root);
      mixer = created;
      states = matchClips(
        model.template.animations.map((clip) => clip.name),
        model.template.animationMap,
      );
      const looping = new Set(
        [...states].filter(([state]) => LOOPING_STATES.has(state)).map(([, clip]) => clip),
      );
      for (const clip of model.template.animations) {
        const action = created.clipAction(clip);
        const loops = looping.has(clip.name);
        action.setLoop(loops ? LoopRepeat : LoopOnce, Infinity);
        action.clampWhenFinished = !loops;
        actions.set(clip.name, action);
        weights.set(action, 0);
      }
      created.addEventListener('finished', (event) => {
        const finished = (event as unknown as { action: AnimationAction }).action;
        if (manual?.once && actions.get(manual.clip) === finished) {
          const name = manual.name;
          manual = null;
          events.push({ name, phase: 'finished' });
          handle.onFinished?.(name);
        }
      });
    };

    const handle: AnimatorHandle = {
      play(name, options = {}) {
        const clip = clipOf(name);
        if (!clip) return false;
        const action = actions.get(clip);
        const once = options.once ?? !LOOPING_STATES.has(name as AnimationState);
        if (action) {
          action.setLoop(once ? LoopOnce : LoopRepeat, Infinity);
          action.clampWhenFinished = once;
          // Playing again starts from the beginning.
          action.reset();
          if ((weights.get(action) ?? 0) === 0) action.play();
        }
        manual = { clip, name, once, fade: options.fade ?? values.crossFade };
        events.push({ name, phase: 'started' });
        return true;
      },
      stop() {
        manual = null;
      },
      speed: 1,
      get current() {
        return current;
      },
      get clips() {
        return [...actions.keys()];
      },
      onFinished: null,
      takeEvents() {
        const taken = events;
        events = [];
        return taken;
      },
    };
    animatorRegistry.set(object, handle);

    /** Target weights and speeds of the clips for this tick. */
    const targets = (dt: number): Map<string, Target> => {
      const result = new Map<string, Target>();
      const set = (state: AnimationState | string, weight = 1, timeScale = 1): boolean => {
        const clip = clipOf(state);
        if (!clip) return false;
        const before = result.get(clip);
        result.set(clip, { weight: (before?.weight ?? 0) + weight, timeScale });
        return true;
      };
      if (manual) {
        set(manual.clip);
        current = manual.name;
        return result;
      }
      const control = values.useControls ? findControl(object) : null;
      if (!control || control.mode === 'vehicle') {
        if (!set(values.defaultState)) set('idle');
        current = values.defaultState;
        return result;
      }
      if (!control.grounded) {
        airTicks += 1;
        const jump = clipOf('jump');
        const jumpLength = jump ? (actions.get(jump)?.getClip().duration ?? 0) : 0;
        if (control.jumping && jump && airTicks * dt < jumpLength) {
          set('jump');
          current = 'jump';
        } else if (set('fall') || set('jump') || set('idle')) current = 'fall';
        return result;
      }
      if (airTicks > 0) lastAir = airTicks * dt;
      airTicks = 0;
      const speed = control.speed;
      const land = clipOf('land');
      const landLength = land ? Math.min(0.35, actions.get(land)?.getClip().duration ?? 0) : 0;
      if (
        land &&
        lastAir > 0.3 &&
        control.ticksSinceLanding * dt < landLength &&
        speed < values.walkClipSpeed
      ) {
        set('land', 1, 1.5);
        current = 'land';
        return result;
      }
      if (control.crouching) {
        const moving = speed > 0.2;
        if ((moving && set('crouchWalk', 1, speed / 1.2)) || set('crouch') || set('idle')) {
          current = moving ? 'crouchWalk' : 'crouch';
        }
        return result;
      }
      // Locomotion blend (Unity: 1D blend tree over speed): idle → walk → run.
      const walk = values.walkClipSpeed;
      const run = Math.max(values.runClipSpeed, walk + 0.1);
      const hasWalk = clipOf('walk') !== null;
      const hasRun = clipOf('run') !== null;
      if (speed < 0.05 || (!hasWalk && !hasRun)) {
        set('idle');
        current = 'idle';
      } else if (speed < walk || !hasRun) {
        const moving = hasWalk ? 'walk' : 'run';
        const reference = hasWalk ? walk : run;
        const share = Math.min(1, speed / walk);
        set('idle', 1 - share);
        set(moving, share, Math.max(0.5, speed / reference));
        current = share >= 0.5 ? moving : 'idle';
      } else if (speed < run && hasWalk) {
        const share = (speed - walk) / (run - walk);
        set('walk', 1 - share, speed / walk);
        set('run', share, speed / run);
        current = share >= 0.5 ? 'run' : 'walk';
      } else {
        set('run', 1, speed / run);
        current = 'run';
      }
      return result;
    };

    /** Keeps walk and run in step while both play (no stumbling between them). */
    const syncLocomotion = (): void => {
      const walk = clipOf('walk');
      const run = clipOf('run');
      const a = walk ? actions.get(walk) : undefined;
      const b = run ? actions.get(run) : undefined;
      if (!a || !b || a === b) return;
      const wa = weights.get(a) ?? 0;
      const wb = weights.get(b) ?? 0;
      if (wa === 0 || wb === 0) return;
      const [lead, follow] = wa >= wb ? [a, b] : [b, a];
      const phase = lead.time / lead.getClip().duration;
      follow.time = phase * follow.getClip().duration;
    };

    return {
      apply(next) {
        values = next;
        handle.speed = next.speed;
      },
      tick(stage, context) {
        if (stage !== 'animate') return;
        const model = findModel(object);
        if (model !== bound) {
          if (model) bind(model);
          else unbind();
        }
        if (!mixer) return;
        const wanted = targets(context.dt);
        const fade = manual ? manual.fade : values.crossFade;
        const step = fade <= 0 ? 1 : context.dt / fade;
        for (const [clip, action] of actions) {
          const target = wanted.get(clip);
          const goal = Math.min(1, target?.weight ?? 0);
          const before = weights.get(action) ?? 0;
          const weight =
            goal > before ? Math.min(goal, before + step) : Math.max(goal, before - step);
          if (weight > 0 && before === 0 && goal > 0) {
            // A clip that comes back starts over, unless it loops (idle, walk …).
            if (action.loop === LoopOnce) action.reset();
            action.play();
          }
          weights.set(action, weight);
          action.setEffectiveWeight(weight);
          if (target) action.setEffectiveTimeScale(target.timeScale * handle.speed);
          if (weight === 0 && goal === 0 && action.isRunning()) action.stop();
        }
        syncLocomotion();
        mixer.update(context.dt);
      },
      destroy() {
        unbind();
        if (animatorRegistry.get(object) === handle) animatorRegistry.delete(object);
      },
    };
  },
});

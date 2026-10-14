import { PerspectiveCamera } from 'three';
import { defineComponent } from './defineComponent';

/** Cameras created by camera components, by owning object. */
export const cameraRegistry = new WeakMap<object, CameraEntry>();

/** A camera created by a camera component. */
export interface CameraEntry {
  readonly camera: PerspectiveCamera;
  enabled: boolean;
  /** Which player the camera shows: `all` (one shared view), `1` or `2` (split screen). */
  player: 'all' | '1' | '2';
  /** How the screen is split when both players have a camera. */
  split: 'horizontal' | 'vertical';
  /** Field of view from the component; camera behaviors add effects on top. */
  baseFov: number;
  /** Seconds of the smooth transition when this camera takes over the view. */
  blendTime: number;
  /** Extra field of view set by camera behaviors each tick (e.g. while sprinting). */
  fovBoost: number;
  /** Shakes the camera (block "camera shake"); strength in degrees, fading out. */
  shake(strength: number, seconds: number): void;
  /** Changes the field of view smoothly over `seconds` (block "set field of view"). */
  animateFov(fov: number, seconds: number): void;
}

/** Deterministic wobble in [-1, 1] for camera shake. */
function wobble(time: number, seed: number): number {
  return (Math.sin(time * 37.3 + seed) + Math.sin(time * 23.9 + seed * 2.1)) / 2;
}

/** Camera (Unity: Camera). Looks along the object's forward axis (+Z). */
export const camera = defineComponent({
  type: 'camera',
  category: 'rendering',
  unique: true,
  unity: 'Camera',
  text: { de: 'Kamera', en: 'Camera' },
  docs: {
    de: 'Zeigt die Szene im Spiel aus Sicht dieses Objekts.',
    en: 'Renders the scene in the game from this object.',
  },
  keywords: { de: ['ansicht', 'sicht'], en: ['view'] },
  fields: {
    fieldOfView: {
      type: 'number',
      default: 60,
      min: 1,
      max: 179,
      step: 1,
      unit: 'degrees',
      text: { de: 'Sichtfeld', en: 'Field of View' },
    },
    near: {
      type: 'number',
      default: 0.1,
      min: 0.01,
      step: 0.01,
      unit: 'meters',
      text: { de: 'Nahe Grenze', en: 'Near' },
    },
    far: {
      type: 'number',
      default: 1000,
      min: 1,
      step: 10,
      unit: 'meters',
      text: { de: 'Ferne Grenze', en: 'Far' },
    },
    player: {
      type: 'enum',
      default: 'all',
      options: [
        { value: 'all', text: { de: 'Alle (ganzer Bildschirm)', en: 'All (full screen)' } },
        { value: '1', text: { de: 'Spieler 1', en: 'Player 1' } },
        { value: '2', text: { de: 'Spieler 2', en: 'Player 2' } },
      ],
      text: { de: 'Spieler', en: 'Player' },
    },
    split: {
      type: 'enum',
      default: 'vertical',
      options: [
        { value: 'vertical', text: { de: 'Nebeneinander', en: 'Side by Side' } },
        { value: 'horizontal', text: { de: 'Übereinander', en: 'Top and Bottom' } },
      ],
      visibleIf: { field: 'player', empty: false },
      text: { de: 'Geteilter Bildschirm', en: 'Split Screen' },
    },
    blendTime: {
      type: 'number',
      default: 0.5,
      min: 0,
      step: 0.1,
      unit: 'seconds',
      text: { de: 'Übergangszeit', en: 'Blend Time' },
    },
  },
  create({ object }) {
    const view = new PerspectiveCamera(60, 16 / 9, 0.1, 1000);
    // three.js cameras look along -Z; objects face +Z, so turn the camera around.
    view.rotation.y = Math.PI;
    object.object3d.add(view);
    let shake = { strength: 0, remaining: 0, duration: 1 };
    let fovAnimation: { from: number; to: number; elapsed: number; duration: number } | null = null;
    let time = 0;
    const entry: CameraEntry = {
      camera: view,
      enabled: true,
      player: 'all',
      split: 'vertical',
      baseFov: 60,
      blendTime: 0.5,
      fovBoost: 0,
      shake(strength, seconds) {
        if (seconds <= 0 || strength <= 0) return;
        shake = { strength, remaining: seconds, duration: seconds };
      },
      animateFov(fov, seconds) {
        const to = Math.min(179, Math.max(1, fov));
        if (seconds <= 0) {
          entry.baseFov = to;
          fovAnimation = null;
        } else fovAnimation = { from: entry.baseFov, to, elapsed: 0, duration: seconds };
      },
    };
    cameraRegistry.set(object, entry);
    return {
      tick(stage, context) {
        if (stage !== 'camera') return;
        time += context.dt;
        if (fovAnimation) {
          fovAnimation.elapsed += context.dt;
          const t = Math.min(1, fovAnimation.elapsed / fovAnimation.duration);
          const eased = t * t * (3 - 2 * t);
          entry.baseFov = fovAnimation.from + (fovAnimation.to - fovAnimation.from) * eased;
          if (t >= 1) fovAnimation = null;
        }
        const fov = Math.min(179, Math.max(1, entry.baseFov + entry.fovBoost));
        if (view.fov !== fov) {
          view.fov = fov;
          view.updateProjectionMatrix();
        }
        // Shake turns the lens a little around the object's view, fading out.
        let amount = 0;
        if (shake.remaining > 0) {
          shake.remaining = Math.max(0, shake.remaining - context.dt);
          amount = ((shake.strength * shake.remaining) / shake.duration) * (Math.PI / 180);
        }
        view.rotation.set(
          amount * wobble(time, 1),
          Math.PI + amount * wobble(time, 2),
          amount * wobble(time, 3) * 0.5,
        );
      },
      apply(values) {
        view.fov = values.fieldOfView + entry.fovBoost;
        entry.baseFov = values.fieldOfView;
        entry.blendTime = values.blendTime;
        entry.player = values.player as CameraEntry['player'];
        entry.split = values.split as CameraEntry['split'];
        view.near = values.near;
        view.far = Math.max(values.far, values.near + 0.01);
        view.updateProjectionMatrix();
      },
      setEnabled(enabled) {
        entry.enabled = enabled;
      },
      destroy() {
        view.removeFromParent();
        cameraRegistry.delete(object);
      },
    };
  },
});

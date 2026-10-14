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
  },
  create({ object }) {
    const view = new PerspectiveCamera(60, 16 / 9, 0.1, 1000);
    // three.js cameras look along -Z; objects face +Z, so turn the camera around.
    view.rotation.y = Math.PI;
    object.object3d.add(view);
    const entry: CameraEntry = {
      camera: view,
      enabled: true,
      player: 'all',
      split: 'vertical',
      baseFov: 60,
    };
    cameraRegistry.set(object, entry);
    return {
      apply(values) {
        view.fov = values.fieldOfView;
        entry.baseFov = values.fieldOfView;
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

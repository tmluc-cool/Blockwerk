import { PerspectiveCamera } from 'three';
import { defineComponent } from './defineComponent';

/** Cameras created by camera components, by owning object. */
export const cameraRegistry = new WeakMap<
  object,
  { camera: PerspectiveCamera; enabled: boolean }
>();

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
  },
  create({ object }) {
    const view = new PerspectiveCamera(60, 16 / 9, 0.1, 1000);
    // three.js cameras look along -Z; objects face +Z, so turn the camera around.
    view.rotation.y = Math.PI;
    object.object3d.add(view);
    const entry = { camera: view, enabled: true };
    cameraRegistry.set(object, entry);
    return {
      apply(values) {
        view.fov = values.fieldOfView;
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

import { Color, Fog, Vector3 } from 'three';
import { defineComponent } from './defineComponent';
import type { FieldDefinitions } from './defineComponent';
import { onQualityChange, qualitySettings } from '../rendering/quality';
import { WaterSurface } from '../water/WaterSurface';
import type { WaterSettings } from '../water/WaterSurface';

const fields = {
  width: {
    type: 'number',
    default: 20,
    min: 1,
    step: 1,
    unit: 'meters',
    text: { de: 'Breite', en: 'Width' },
  },
  depth: {
    type: 'number',
    default: 20,
    min: 1,
    step: 1,
    unit: 'meters',
    text: { de: 'Länge', en: 'Length' },
  },
  shallowColor: {
    type: 'color',
    default: '#3ea5bc',
    text: { de: 'Farbe (flach)', en: 'Shallow Color' },
  },
  deepColor: { type: 'color', default: '#0c3a58', text: { de: 'Farbe (tief)', en: 'Deep Color' } },
  waveHeight: {
    type: 'number',
    default: 0.12,
    min: 0,
    max: 2,
    step: 0.02,
    unit: 'meters',
    text: { de: 'Wellenhöhe', en: 'Wave Height' },
  },
  waveSpeed: {
    type: 'number',
    default: 1,
    min: 0,
    max: 4,
    step: 0.1,
    text: { de: 'Wellentempo', en: 'Wave Speed' },
  },
  clarity: {
    type: 'number',
    default: 0.5,
    min: 0,
    max: 1,
    step: 0.05,
    text: { de: 'Klarheit', en: 'Clarity' },
  },
  swimmable: {
    type: 'boolean',
    default: true,
    text: { de: 'Man kann schwimmen', en: 'Swimmable' },
  },
} as const satisfies FieldDefinitions;

const SUN = new Vector3();
const DAY_SKY = new Color('#a8c6e6');
const NIGHT_SKY = new Color('#0b1220');

/** Water (Unity: Water): waves, reflections of the sky and the scene, and swimming. */
export const water = defineComponent({
  type: 'water',
  category: 'rendering',
  unique: true,
  unity: 'Water',
  text: { de: 'Wasser', en: 'Water' },
  docs: {
    de: 'Eine Wasserfläche mit Wellen, Spiegelung und Sonnenglitzern. Die Oberfläche liegt auf der Höhe des Objekts. Figuren schwimmen darin, wenn „Man kann schwimmen“ an ist. Die Grafikstufe bestimmt die Spiegelung.',
    en: 'A water surface with waves, reflections and sun glints. The surface lies at the height of the object. Characters swim in it when "Swimmable" is on. The graphics level decides how the water reflects.',
  },
  keywords: {
    de: ['see', 'meer', 'fluss', 'teich'],
    en: ['lake', 'sea', 'river', 'pond', 'ocean'],
  },
  fields,
  create({ object, world }) {
    const surface = new WaterSurface({
      sunDirection: () => world.environment.getSunDirection(SUN),
      sunColor: () => {
        const sun = world.environment.sun;
        const strength = Math.min(1, sun.intensity / 4);
        return sun.color.clone().multiplyScalar(strength);
      },
      skyColor: () => {
        const fog = world.scene.fog;
        const base = fog instanceof Fog ? fog.color : DAY_SKY;
        return base.clone().lerp(NIGHT_SKY, 1 - world.environment.daylightLevel);
      },
    });
    object.object3d.add(surface.root);
    let values: {
      width: number;
      depth: number;
      shallowColor: string;
      deepColor: string;
      waveHeight: number;
      waveSpeed: number;
      clarity: number;
      swimmable: boolean;
    } | null = null;
    let enabled = true;
    const settings = (): WaterSettings | null =>
      values
        ? {
            size: [values.width, values.depth],
            shallowColor: values.shallowColor,
            deepColor: values.deepColor,
            waveHeight: values.waveHeight,
            waveSpeed: values.waveSpeed,
            clarity: values.clarity,
            reflection: qualitySettings().waterReflection,
          }
        : null;
    const refresh = (): void => {
      const next = settings();
      if (next) surface.configure(next);
    };
    const stopListening = onQualityChange(refresh);
    const body = {
      surfaceAt(x: number, z: number): number | null {
        if (!enabled || !values?.swimmable) return null;
        const local = object.object3d.worldToLocal(new Vector3(x, object.worldPosition().y, z));
        if (Math.abs(local.x) > values.width / 2 || Math.abs(local.z) > values.depth / 2) {
          return null;
        }
        return object.worldPosition().y;
      },
    };
    world.waters.add(body);
    return {
      apply(next) {
        values = next;
        refresh();
      },
      setEnabled(value) {
        enabled = value;
        surface.root.visible = value;
      },
      destroy() {
        stopListening();
        world.waters.delete(body);
        surface.dispose();
      },
    };
  },
});

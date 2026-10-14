import { DEFAULT_POST_SETTINGS, TONE_MAPPINGS } from '../rendering/PostProcessing';
import type { PostSettings } from '../rendering/PostProcessing';
import { defineComponent } from './defineComponent';

/** Post-processing settings by object (read by the views when they draw the object's camera). */
/** `null` means the component is there but switched off (no effects, not even the defaults). */
export const postRegistry = new WeakMap<object, PostSettings | null>();

const D = DEFAULT_POST_SETTINGS;

/**
 * Post-processing on a camera object (Unity: Volume with a profile): tone mapping, bloom,
 * ambient occlusion, anti-aliasing, color grading, vignette and depth of field. The graphics
 * level limits what runs (Low: nothing, Medium: bloom and anti-aliasing, High: and occlusion,
 * Ultra: and depth of field).
 */
export const postProcessing = defineComponent({
  type: 'postProcessing',
  category: 'rendering',
  unique: true,
  unity: 'Volume',
  text: { de: 'Nachbearbeitung', en: 'Post-Processing' },
  docs: {
    de: 'Bildeffekte auf dieser Kamera: Tone-Mapping, Bloom, Umgebungsverdeckung, Kantenglättung, Farbkorrektur, Vignette und Tiefenunschärfe. Die Grafikstufe begrenzt, was läuft.',
    en: 'Image effects on this camera: tone mapping, bloom, ambient occlusion, anti-aliasing, color grading, vignette and depth of field. The graphics level limits what runs.',
  },
  keywords: {
    de: ['bloom', 'effekte', 'vignette', 'farbe', 'ao'],
    en: ['bloom', 'effects', 'vignette', 'color', 'ao', 'volume'],
  },
  fields: {
    toneMapping: {
      type: 'enum',
      default: D.toneMapping,
      options: TONE_MAPPINGS.map((value) => ({
        value,
        text: {
          aces: { de: 'ACES (filmisch)', en: 'ACES (filmic)' },
          agx: { de: 'AgX', en: 'AgX' },
          neutral: { de: 'Neutral', en: 'Neutral' },
          none: { de: 'Aus', en: 'None' },
        }[value],
      })),
      text: { de: 'Tone-Mapping', en: 'Tone Mapping' },
    },
    exposure: {
      type: 'number',
      default: D.exposure,
      min: 0,
      step: 0.05,
      text: { de: 'Belichtung', en: 'Exposure' },
    },
    bloom: { type: 'boolean', default: D.bloom, text: { de: 'Bloom', en: 'Bloom' } },
    bloomIntensity: {
      type: 'number',
      default: D.bloomIntensity,
      min: 0,
      step: 0.05,
      group: 'bloom',
      text: { de: 'Bloom-Stärke', en: 'Bloom Intensity' },
    },
    bloomThreshold: {
      type: 'number',
      default: D.bloomThreshold,
      min: 0,
      step: 0.05,
      group: 'bloom',
      text: { de: 'Bloom-Schwelle', en: 'Bloom Threshold' },
    },
    ambientOcclusion: {
      type: 'boolean',
      default: D.ambientOcclusion,
      text: { de: 'Umgebungsverdeckung', en: 'Ambient Occlusion' },
    },
    aoRadius: {
      type: 'number',
      default: D.aoRadius,
      min: 0.1,
      step: 0.1,
      unit: 'meters',
      group: 'occlusion',
      text: { de: 'Verdeckungs-Radius', en: 'Occlusion Radius' },
    },
    aoIntensity: {
      type: 'number',
      default: D.aoIntensity,
      min: 0,
      step: 0.1,
      group: 'occlusion',
      text: { de: 'Verdeckungs-Stärke', en: 'Occlusion Intensity' },
    },
    antialiasing: {
      type: 'boolean',
      default: D.antialiasing,
      text: { de: 'Kantenglättung', en: 'Anti-Aliasing' },
    },
    saturation: {
      type: 'number',
      default: D.saturation,
      min: 0,
      step: 0.05,
      group: 'grading',
      text: { de: 'Sättigung', en: 'Saturation' },
    },
    contrast: {
      type: 'number',
      default: D.contrast,
      min: -1,
      max: 1,
      step: 0.01,
      group: 'grading',
      text: { de: 'Kontrast', en: 'Contrast' },
    },
    brightness: {
      type: 'number',
      default: D.brightness,
      min: -1,
      max: 1,
      step: 0.01,
      group: 'grading',
      text: { de: 'Helligkeit', en: 'Brightness' },
    },
    vignette: { type: 'boolean', default: D.vignette, text: { de: 'Vignette', en: 'Vignette' } },
    vignetteDarkness: {
      type: 'number',
      default: D.vignetteDarkness,
      min: 0,
      max: 1,
      step: 0.05,
      group: 'vignette',
      text: { de: 'Vignetten-Stärke', en: 'Vignette Darkness' },
    },
    depthOfField: {
      type: 'boolean',
      default: D.depthOfField,
      text: { de: 'Tiefenunschärfe', en: 'Depth of Field' },
    },
    focusDistance: {
      type: 'number',
      default: D.focusDistance,
      min: 0.1,
      step: 0.5,
      unit: 'meters',
      group: 'depth',
      text: { de: 'Schärfe-Abstand', en: 'Focus Distance' },
    },
    bokehScale: {
      type: 'number',
      default: D.bokehScale,
      min: 0,
      step: 0.1,
      group: 'depth',
      text: { de: 'Unschärfe-Stärke', en: 'Blur Size' },
    },
  },
  create({ object }) {
    let enabled = true;
    let settings: PostSettings | null = null;
    const publish = (): void => {
      postRegistry.set(object, enabled && settings ? settings : null);
    };
    return {
      apply(values) {
        settings = values as PostSettings;
        publish();
      },
      setEnabled(value) {
        enabled = value;
        publish();
      },
      destroy() {
        postRegistry.delete(object);
      },
    };
  },
});

import { Vector3 } from 'three';
import { defineComponent } from './defineComponent';
import type { FieldDefinitions } from './defineComponent';
import { AUDIO_BUSES } from '../audio/AudioEngine';
import type { SoundHandle } from '../audio/AudioEngine';
import type { GameObject } from '../world/GameObject';

/** What a blocks or a test can do with an audio source. */
export interface AudioSourceState {
  play(): void;
  stop(): void;
  readonly playing: boolean;
}

/** Audio source states by object. */
export const audioSourceRegistry = new WeakMap<GameObject, AudioSourceState>();

const BUS_TEXT: Record<string, { de: string; en: string }> = {
  music: { de: 'Musik', en: 'Music' },
  effects: { de: 'Effekte', en: 'Effects' },
  voices: { de: 'Stimmen', en: 'Voices' },
};

const fields = {
  sound: {
    type: 'asset',
    assetType: 'sound',
    required: true,
    default: null,
    text: { de: 'Klang', en: 'Sound' },
  },
  volume: {
    type: 'number',
    default: 1,
    min: 0,
    max: 1,
    step: 0.05,
    text: { de: 'Lautstärke', en: 'Volume' },
  },
  pitch: {
    type: 'number',
    default: 1,
    min: 0.25,
    max: 3,
    step: 0.05,
    text: { de: 'Tonhöhe', en: 'Pitch' },
  },
  loop: { type: 'boolean', default: false, text: { de: 'Wiederholen', en: 'Loop' } },
  playOnAwake: {
    type: 'boolean',
    default: true,
    text: { de: 'Beim Start abspielen', en: 'Play On Awake' },
  },
  bus: {
    type: 'enum',
    default: 'effects',
    options: AUDIO_BUSES.map((value) => ({
      value,
      text: BUS_TEXT[value] ?? { de: value, en: value },
    })),
    text: { de: 'Kanal', en: 'Channel' },
  },
  spatial: {
    type: 'boolean',
    default: true,
    group: 'spatial',
    text: { de: '3D-Klang', en: '3D Sound' },
  },
  minDistance: {
    type: 'number',
    default: 1,
    min: 0,
    step: 0.5,
    unit: 'meters',
    group: 'spatial',
    text: { de: 'Volle Lautstärke bis', en: 'Full Volume Up To' },
  },
  maxDistance: {
    type: 'number',
    default: 30,
    min: 1,
    step: 1,
    unit: 'meters',
    group: 'spatial',
    text: { de: 'Nicht mehr hörbar ab', en: 'Silent From' },
  },
} as const satisfies FieldDefinitions;

/** Audio source (Unity: Audio Source): plays a sound, in 3D at the object's position. */
export const audioSource = defineComponent({
  type: 'audioSource',
  category: 'audio',
  unique: false,
  unity: 'Audio Source',
  text: { de: 'Audio-Quelle', en: 'Audio Source' },
  docs: {
    de: 'Spielt einen Klang ab. Mit „3D-Klang“ wird er mit der Entfernung leiser und kommt aus der Richtung des Objekts. Eingebaute Klänge und importierte Dateien (WAV, OGG, MP3) funktionieren gleich.',
    en: 'Plays a sound. With "3D Sound" it gets quieter with distance and comes from the direction of the object. Built-in sounds and imported files (WAV, OGG, MP3) work the same.',
  },
  keywords: {
    de: ['klang', 'musik', 'geräusch', 'lautsprecher', 'ton'],
    en: ['sound', 'music', 'noise', 'speaker', 'audio'],
  },
  fields,
  create({ object, world }) {
    let values: {
      sound: string | null;
      volume: number;
      pitch: number;
      loop: boolean;
      playOnAwake: boolean;
      bus: string;
      spatial: boolean;
      minDistance: number;
      maxDistance: number;
    } | null = null;
    let handle: SoundHandle | null = null;
    let enabled = true;
    let started = false;
    const position = new Vector3();
    const play = (): void => {
      const engine = world.audio;
      if (!engine || !values?.sound || !enabled) return;
      handle?.stop();
      handle = engine.play(values.sound, {
        bus: values.bus === 'music' || values.bus === 'voices' ? values.bus : 'effects',
        volume: values.volume,
        pitch: values.pitch,
        loop: values.loop,
        position: values.spatial ? object.worldPosition(position) : null,
        minDistance: values.minDistance,
        maxDistance: values.maxDistance,
      });
    };
    const state: AudioSourceState = {
      play,
      stop() {
        handle?.stop();
        handle = null;
      },
      get playing() {
        return handle?.playing ?? false;
      },
    };
    audioSourceRegistry.set(object, state);
    return {
      apply(next) {
        values = next;
        handle?.setVolume(next.volume);
      },
      tick(stage) {
        if (stage !== 'animate') return;
        if (!started) {
          started = true;
          if (values?.playOnAwake) play();
        }
        if (handle?.playing && values?.spatial) handle.setPosition(object.worldPosition(position));
      },
      setEnabled(value) {
        enabled = value;
        if (!value) state.stop();
        else if (started && values?.playOnAwake) play();
      },
      destroy() {
        state.stop();
        audioSourceRegistry.delete(object);
      },
    };
  },
});

/** Audio listener (Unity: Audio Listener): where the game is heard from. Default is the camera. */
export const audioListener = defineComponent({
  type: 'audioListener',
  category: 'audio',
  unique: true,
  unity: 'Audio Listener',
  text: { de: 'Audio-Listener', en: 'Audio Listener' },
  docs: {
    de: 'Die „Ohren“ des Spiels: Klänge werden von der Stelle dieses Objekts aus gehört. Ohne Audio-Listener hört man von der Kamera aus.',
    en: 'The "ears" of the game: sounds are heard from this object’s position. Without an Audio Listener the camera hears.',
  },
  keywords: { de: ['ohren', 'hören'], en: ['ears', 'hear'] },
  fields: {},
  create() {
    return {
      apply() {},
      destroy() {},
    };
  },
});

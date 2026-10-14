import { Vector3 } from 'three';
import { isBuiltinSound, SYNTH_RATE, synthesize } from './synth';
import type { BuiltinSound } from './synth';

/** The mixer channels (SPEC 8.11): each has its own volume. */
export const AUDIO_BUSES = ['music', 'effects', 'voices'] as const;
export type AudioBus = (typeof AUDIO_BUSES)[number];

/** Whether a text names a mixer channel. */
export function isAudioBus(value: string): value is AudioBus {
  return (AUDIO_BUSES as readonly string[]).includes(value);
}

/** How a sound is played. */
export interface PlayOptions {
  /** Mixer channel (default `effects`). */
  readonly bus?: AudioBus;
  /** Loudness 0..1 (default 1). */
  readonly volume?: number;
  /** Playback speed, 1 = as recorded. */
  readonly pitch?: number;
  readonly loop?: boolean;
  /** Where the sound is in the world; without it the sound is heard evenly everywhere. */
  readonly position?: Vector3 | null;
  /** Distance in meters up to which the sound is at full volume (default 1). */
  readonly minDistance?: number;
  /** Distance in meters at which the sound is gone (default 30). */
  readonly maxDistance?: number;
}

/** A sound that plays or has played. */
export interface SoundHandle {
  readonly playing: boolean;
  /** Stops the sound, fading out over `fade` seconds. */
  stop(fade?: number): void;
  /** Moves the sound in the world. */
  setPosition(position: Vector3): void;
  setVolume(volume: number): void;
}

/** Where sounds of the project come from: an asset ID to the file's bytes, or `null`. */
export type AudioSource = (assetId: string) => ArrayBuffer | null;

let projectSource: AudioSource = () => null;

/** Sets where audio assets of the project are read from (the editor's project, a game's files). */
export function setAudioSource(source: AudioSource): void {
  projectSource = source;
}

/** Options of an {@link AudioEngine}. */
export interface AudioEngineOptions {
  /** Makes the Web Audio context; return `null` where there is no audio (tests, servers). */
  readonly createContext?: () => AudioContext | null;
}

interface Playing {
  readonly handle: SoundHandle & { end(): void };
  readonly bus: AudioBus;
}

const DEFAULT_MAX_DISTANCE = 30;

/** The default Web Audio context, or `null` outside a browser. */
function browserContext(): AudioContext | null {
  return typeof AudioContext === 'undefined' ? null : new AudioContext();
}

/**
 * The game's sound system on Web Audio: 3D sounds through panner nodes (loudness and direction
 * follow the listener), three mixer channels, music with cross-fades. Without a Web Audio
 * context (tests, servers) every call is silently ignored.
 */
export class AudioEngine {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private readonly buses = new Map<AudioBus, GainNode>();
  private readonly volumes: Record<AudioBus | 'master', number> = {
    master: 1,
    music: 0.6,
    effects: 1,
    voices: 1,
  };
  private muted = false;
  private readonly buffers = new Map<string, Promise<AudioBuffer | null>>();
  private readonly playing = new Set<Playing>();
  private music: { id: string; handle: SoundHandle } | null = null;
  private weatherLoops: { rain: SoundHandle | null; wind: SoundHandle | null } = {
    rain: null,
    wind: null,
  };
  private readonly listenerPosition = new Vector3();
  private readonly listenerForward = new Vector3(0, 0, -1);
  private readonly listenerUp = new Vector3(0, 1, 0);
  /** The sounds played so far, newest last (tests, statistics); at most 200 are kept. */
  readonly played: string[] = [];
  private disposed = false;
  private unavailable = false;

  constructor(private readonly options: AudioEngineOptions = {}) {}

  /** Whether sound can play (a Web Audio context exists). */
  get available(): boolean {
    return this.ensure() !== null;
  }

  /** Number of sounds that are playing now (tests, statistics). */
  get activeSounds(): number {
    return this.playing.size;
  }

  /** The id of the music that plays, or `null`. */
  get currentMusic(): string | null {
    return this.music?.id ?? null;
  }

  /** The Web Audio context (created on first use), or `null` where there is no audio. */
  private ensure(): AudioContext | null {
    if (this.disposed || this.unavailable) return null;
    if (this.context) return this.context;
    const make = this.options.createContext ?? browserContext;
    let context: AudioContext | null;
    try {
      context = make();
    } catch {
      context = null;
    }
    if (!context) {
      this.unavailable = true;
      return null;
    }
    this.context = context;
    this.master = context.createGain();
    this.master.connect(context.destination);
    for (const bus of AUDIO_BUSES) {
      const gain = context.createGain();
      gain.connect(this.master);
      this.buses.set(bus, gain);
    }
    this.applyVolumes();
    this.applyListener();
    return context;
  }

  /** Lets sound start after the browser allowed it (call from a click or key press). */
  resume(): void {
    const context = this.ensure();
    if (context && context.state === 'suspended') void context.resume();
  }

  /** Sets the volume (0..1) of a mixer channel, or of everything with `master`. */
  setVolume(bus: AudioBus | 'master', volume: number): void {
    this.volumes[bus] = Math.min(1, Math.max(0, volume));
    this.applyVolumes();
  }

  /** The volume (0..1) of a mixer channel. */
  volume(bus: AudioBus | 'master'): number {
    return this.volumes[bus];
  }

  /** Mutes or unmutes all sound (the Game view's mute button). */
  setMuted(muted: boolean): void {
    this.muted = muted;
    this.applyVolumes();
  }

  private applyVolumes(): void {
    if (!this.master) return;
    this.master.gain.value = this.muted ? 0 : this.volumes.master;
    for (const bus of AUDIO_BUSES) {
      const gain = this.buses.get(bus);
      if (gain) gain.gain.value = this.volumes[bus];
    }
  }

  /** Where the listener is: the camera's position and which way it looks and is up. */
  setListener(position: Vector3, forward: Vector3, up: Vector3): void {
    this.listenerPosition.copy(position);
    this.listenerForward.copy(forward);
    this.listenerUp.copy(up);
    this.applyListener();
  }

  /** Hands the remembered listener pose to the context (once it exists). */
  private applyListener(): void {
    const context = this.context;
    if (!context) return;
    const position = this.listenerPosition;
    const forward = this.listenerForward;
    const up = this.listenerUp;
    const listener = context.listener;
    if (listener.positionX) {
      listener.positionX.value = position.x;
      listener.positionY.value = position.y;
      listener.positionZ.value = position.z;
      listener.forwardX.value = forward.x;
      listener.forwardY.value = forward.y;
      listener.forwardZ.value = forward.z;
      listener.upX.value = up.x;
      listener.upY.value = up.y;
      listener.upZ.value = up.z;
    } else {
      // Older Safari.
      const legacy = listener as unknown as {
        setPosition?: (x: number, y: number, z: number) => void;
        setOrientation?: (...values: number[]) => void;
      };
      legacy.setPosition?.(position.x, position.y, position.z);
      legacy.setOrientation?.(forward.x, forward.y, forward.z, up.x, up.y, up.z);
    }
  }

  /** The audio data of a sound: built-in ones are made in code, project ones are decoded. */
  private load(id: string): Promise<AudioBuffer | null> {
    let buffer = this.buffers.get(id);
    if (!buffer) {
      buffer = this.fetchBuffer(id);
      this.buffers.set(id, buffer);
    }
    return buffer;
  }

  private async fetchBuffer(id: string): Promise<AudioBuffer | null> {
    const context = this.ensure();
    if (!context) return null;
    const name = id.startsWith('builtin:') ? id.slice('builtin:'.length) : id;
    if (isBuiltinSound(name)) return makeBuiltin(context, name);
    const assetId = id.startsWith('audio:') ? id.slice('audio:'.length) : id;
    const bytes = projectSource(assetId);
    if (!bytes) return null;
    try {
      return await context.decodeAudioData(bytes.slice(0));
    } catch {
      return null;
    }
  }

  /** Plays a sound (a built-in name, `builtin:<name>` or an audio asset ID). */
  play(id: string, options: PlayOptions = {}): SoundHandle {
    const bus = options.bus ?? 'effects';
    this.played.push(id);
    if (this.played.length > 200) this.played.shift();
    let stopped = false;
    let source: AudioBufferSourceNode | null = null;
    let gain: GainNode | null = null;
    let panner: PannerNode | null = null;
    let volume = options.volume ?? 1;
    let position = options.position ? options.position.clone() : null;
    let ended = false;
    const entry: Playing = {
      bus,
      handle: {
        get playing() {
          return !ended;
        },
        stop: (fade = 0) => {
          stopped = true;
          const context = this.context;
          if (!source || !gain || !context) {
            ended = true;
            this.playing.delete(entry);
            return;
          }
          const now = context.currentTime;
          if (fade > 0) {
            gain.gain.cancelScheduledValues(now);
            gain.gain.setValueAtTime(gain.gain.value, now);
            gain.gain.linearRampToValueAtTime(0, now + fade);
            source.stop(now + fade);
          } else {
            source.stop();
          }
        },
        setPosition: (next) => {
          position = next.clone();
          if (panner) setPannerPosition(panner, next);
        },
        setVolume: (next) => {
          volume = next;
          if (gain) gain.gain.value = next;
        },
        end: () => {
          ended = true;
          this.playing.delete(entry);
          source?.disconnect();
          gain?.disconnect();
          panner?.disconnect();
        },
      },
    };
    this.playing.add(entry);
    const context = this.ensure();
    if (!context) {
      entry.handle.end();
      return entry.handle;
    }
    void this.load(id).then((buffer) => {
      if (!buffer || stopped || this.disposed || ended) {
        entry.handle.end();
        return;
      }
      source = context.createBufferSource();
      source.buffer = buffer;
      source.loop = options.loop ?? false;
      source.playbackRate.value = options.pitch ?? 1;
      gain = context.createGain();
      gain.gain.value = volume;
      source.connect(gain);
      const busNode = this.buses.get(bus) ?? this.master;
      if (position) {
        panner = context.createPanner();
        panner.panningModel = 'HRTF';
        panner.distanceModel = 'linear';
        panner.refDistance = options.minDistance ?? 1;
        panner.maxDistance = options.maxDistance ?? DEFAULT_MAX_DISTANCE;
        panner.rolloffFactor = 1;
        setPannerPosition(panner, position);
        gain.connect(panner);
        if (busNode) panner.connect(busNode);
      } else if (busNode) {
        gain.connect(busNode);
      }
      source.onended = () => entry.handle.end();
      source.start();
    });
    return entry.handle;
  }

  /** Plays music in a loop; a different piece fades over from the one that plays. */
  playMusic(id: string, fade = 1): void {
    this.crossfadeMusic(id, fade);
  }

  /** Fades the music over to another piece in `seconds` seconds. */
  crossfadeMusic(id: string, seconds: number): void {
    if (this.music?.id === id) return;
    const previous = this.music;
    previous?.handle.stop(Math.max(0, seconds));
    const handle = this.play(id, { bus: 'music', loop: true, volume: seconds > 0 ? 0 : 1 });
    this.music = { id, handle };
    if (seconds > 0) this.fadeIn(handle, seconds);
  }

  /** Fades the volume of a sound up to full over `seconds` seconds. */
  private fadeIn(handle: SoundHandle, seconds: number): void {
    const steps = Math.max(2, Math.round(seconds * 10));
    let step = 0;
    const timer = setInterval(
      () => {
        step += 1;
        if (!handle.playing && step > 2) {
          clearInterval(timer);
          return;
        }
        handle.setVolume(Math.min(1, step / steps));
        if (step >= steps) clearInterval(timer);
      },
      (seconds * 1000) / steps,
    );
  }

  /** Stops the music, fading out over `seconds` seconds. */
  stopMusic(seconds = 1): void {
    this.music?.handle.stop(seconds);
    this.music = null;
  }

  /** Stops every sound including music and weather sounds. */
  stopAll(): void {
    for (const entry of [...this.playing]) entry.handle.stop(0);
    this.music = null;
    this.weatherLoops = { rain: null, wind: null };
  }

  /**
   * Plays rain and wind sounds that follow the weather: rain gets louder with the intensity of
   * rain, wind with the wind speed.
   */
  updateWeather(type: string, intensity: number, windSpeed: number): void {
    const rainLevel = type === 'rain' ? Math.min(1, intensity) * 0.8 : 0;
    const windLevel =
      Math.min(1, windSpeed / 12) * 0.7 + (type === 'snow' || type === 'fog' ? 0.1 : 0);
    this.followLevel('rain', 'ambient-rain', rainLevel);
    this.followLevel('wind', 'ambient-wind', windLevel);
  }

  private followLevel(key: 'rain' | 'wind', sound: BuiltinSound, level: number): void {
    const current = this.weatherLoops[key];
    if (level <= 0.01) {
      if (current) {
        current.stop(1.5);
        this.weatherLoops[key] = null;
      }
      return;
    }
    if (!current || !current.playing) {
      this.weatherLoops[key] = this.play(sound, { loop: true, volume: level });
    } else {
      current.setVolume(level);
    }
  }

  /** Stops everything and frees the audio context. */
  dispose(): void {
    this.stopAll();
    this.disposed = true;
    const context = this.context;
    this.context = null;
    this.master = null;
    this.buses.clear();
    if (context && context.state !== 'closed') void context.close();
  }
}

function setPannerPosition(panner: PannerNode, position: Vector3): void {
  if (panner.positionX) {
    panner.positionX.value = position.x;
    panner.positionY.value = position.y;
    panner.positionZ.value = position.z;
  } else {
    (
      panner as unknown as { setPosition?: (x: number, y: number, z: number) => void }
    ).setPosition?.(position.x, position.y, position.z);
  }
}

function makeBuiltin(context: AudioContext, name: BuiltinSound): AudioBuffer {
  const samples = synthesize(name);
  const buffer = context.createBuffer(1, samples.length, SYNTH_RATE);
  buffer.copyToChannel(new Float32Array(samples), 0);
  return buffer;
}

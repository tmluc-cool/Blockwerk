/**
 * A stand-in for the Web Audio context that records what the engine does (for tests and for
 * checking the sound system without speakers). It does not make any sound.
 */

class Param {
  value = 1;
  setValueAtTime(value: number): this {
    this.value = value;
    return this;
  }
  linearRampToValueAtTime(value: number): this {
    this.value = value;
    return this;
  }
  cancelScheduledValues(): this {
    return this;
  }
}

class Node {
  readonly outputs: Node[] = [];
  connect(target: Node): Node {
    this.outputs.push(target);
    return target;
  }
  disconnect(): void {
    this.outputs.length = 0;
  }
}

/** A recorded gain node. */
export class RecordedGain extends Node {
  readonly kind = 'gain';
  readonly gain = new Param();
}

/** A recorded 3D panner node. */
export class RecordedPanner extends Node {
  readonly kind = 'panner';
  panningModel = 'equalpower';
  distanceModel = 'inverse';
  refDistance = 1;
  maxDistance = 10000;
  rolloffFactor = 1;
  readonly positionX = new Param();
  readonly positionY = new Param();
  readonly positionZ = new Param();
}

/** A recorded sound that was started. */
export class RecordedSource extends Node {
  readonly kind = 'source';
  buffer: { length: number; sampleRate: number; copyToChannel?: unknown } | null = null;
  loop = false;
  readonly playbackRate = new Param();
  started = false;
  stopped = false;
  onended: (() => void) | null = null;
  start(): void {
    this.started = true;
  }
  stop(): void {
    this.stopped = true;
    queueMicrotask(() => this.onended?.());
  }
  /** Ends the sound as if it played to its end. */
  finish(): void {
    this.stopped = true;
    this.onended?.();
  }

  /** The gains and the panner on the way to the speakers. */
  path(): Node[] {
    const path: Node[] = [];
    let current: Node | undefined = this.outputs[0];
    while (current) {
      path.push(current);
      current = current.outputs[0];
    }
    return path;
  }

  /** The panner of this sound, if it is a 3D sound. */
  get panner(): RecordedPanner | null {
    return (this.path().find((node) => node instanceof RecordedPanner) as RecordedPanner) ?? null;
  }

  /** Loudness before the 3D effect: all gains on the way multiplied. */
  get gainProduct(): number {
    return this.path().reduce(
      (product, node) => (node instanceof RecordedGain ? product * node.gain.value : product),
      1,
    );
  }
}

class RecordedListener {
  readonly positionX = new Param();
  readonly positionY = new Param();
  readonly positionZ = new Param();
  readonly forwardX = new Param();
  readonly forwardY = new Param();
  readonly forwardZ = new Param();
  readonly upX = new Param();
  readonly upY = new Param();
  readonly upZ = new Param();
}

/** Records the sounds an {@link AudioEngine} starts. Cast it with `as unknown as AudioContext`. */
export class RecordingAudioContext {
  readonly destination = new Node();
  readonly listener = new RecordedListener();
  readonly sources: RecordedSource[] = [];
  state: 'suspended' | 'running' | 'closed' = 'running';
  currentTime = 0;
  sampleRate = 44100;

  createGain(): RecordedGain {
    return new RecordedGain();
  }

  createPanner(): RecordedPanner {
    return new RecordedPanner();
  }

  createBufferSource(): RecordedSource {
    const source = new RecordedSource();
    this.sources.push(source);
    return source;
  }

  createBuffer(
    _channels: number,
    length: number,
    sampleRate: number,
  ): { length: number; sampleRate: number; copyToChannel(): void } {
    return { length, sampleRate, copyToChannel: () => undefined };
  }

  decodeAudioData(bytes: ArrayBuffer): Promise<{ length: number; sampleRate: number }> {
    return Promise.resolve({ length: bytes.byteLength, sampleRate: this.sampleRate });
  }

  resume(): Promise<void> {
    this.state = 'running';
    return Promise.resolve();
  }

  close(): Promise<void> {
    this.state = 'closed';
    return Promise.resolve();
  }

  /** Sources that were started and not stopped yet. */
  get playing(): RecordedSource[] {
    return this.sources.filter((source) => source.started && !source.stopped);
  }
}

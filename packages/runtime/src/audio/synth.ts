import { seededRandom } from '../terrain/TerrainData';

/** Sample rate of the built-in sounds (low on purpose: small and enough for effects and pads). */
export const SYNTH_RATE = 22050;

/** Names of the built-in sound effects. */
export const BUILTIN_EFFECTS = [
  'footstep',
  'footstep-grass',
  'footstep-stone',
  'footstep-sand',
  'footstep-wood',
  'jump',
  'land',
  'hurt',
  'win',
  'coin',
  'click',
  'hit',
  'whoosh',
  'explosion',
  'splash',
] as const;

/** Names of the built-in loops: ambient sounds and music. */
export const BUILTIN_LOOPS = [
  'ambient-wind',
  'ambient-rain',
  'ambient-stream',
  'ambient-night',
  'music-calm',
  'music-adventure',
] as const;

/** All built-in sound names. */
export const BUILTIN_SOUNDS = [...BUILTIN_EFFECTS, ...BUILTIN_LOOPS] as const;
export type BuiltinSound = (typeof BUILTIN_SOUNDS)[number];

/** Whether a text names a built-in sound. */
export function isBuiltinSound(value: string): value is BuiltinSound {
  return (BUILTIN_SOUNDS as readonly string[]).includes(value);
}

/** Whether a built-in sound is a loop (it fits end to start). */
export function isLoopingSound(name: BuiltinSound): boolean {
  return (BUILTIN_LOOPS as readonly string[]).includes(name);
}

const TAU = Math.PI * 2;

/** A one-pole low-pass filter; `cutoff` in Hz. */
function lowPass(cutoff: number): (x: number) => number {
  const a = 1 - Math.exp((-TAU * cutoff) / SYNTH_RATE);
  let y = 0;
  return (x) => (y += a * (x - y));
}

/** A one-pole high-pass filter; `cutoff` in Hz. */
function highPass(cutoff: number): (x: number) => number {
  const low = lowPass(cutoff);
  return (x) => x - low(x);
}

/** Linear fade in over `attack` seconds and exponential fade out over the rest. */
function envelope(t: number, length: number, attack: number, curve = 4): number {
  const up = attack > 0 ? Math.min(1, t / attack) : 1;
  const down = Math.exp((-curve * t) / length);
  return up * down;
}

function render(seconds: number, make: (t: number, i: number) => number): Float32Array {
  const out = new Float32Array(Math.round(seconds * SYNTH_RATE));
  for (let i = 0; i < out.length; i++) out[i] = make(i / SYNTH_RATE, i);
  return out;
}

/** Scales a sound so its loudest sample is `peak`. */
function normalize(samples: Float32Array, peak = 0.8): Float32Array {
  let max = 0;
  for (const sample of samples) max = Math.max(max, Math.abs(sample));
  if (max === 0) return samples;
  const gain = peak / max;
  for (let i = 0; i < samples.length; i++) samples[i] = (samples[i] ?? 0) * gain;
  return samples;
}

/** Makes a loop seamless by cross-fading its end into its start. */
function seamless(samples: Float32Array, fadeSeconds: number): Float32Array {
  const fade = Math.min(Math.round(fadeSeconds * SYNTH_RATE), Math.floor(samples.length / 3));
  const body = samples.length - fade;
  const out = new Float32Array(body);
  out.set(samples.subarray(0, body));
  for (let i = 0; i < fade; i++) {
    const mix = i / fade;
    out[i] = (out[i] ?? 0) * mix + (samples[body + i] ?? 0) * (1 - mix);
  }
  return out;
}

function footstep(seed: number, cutoff: number, thump: number, length: number): Float32Array {
  const random = seededRandom(seed);
  const filter = lowPass(cutoff);
  return normalize(
    render(length, (t) => {
      const noise = filter(random() * 2 - 1);
      const body = Math.sin(TAU * thump * t) * Math.exp(-t * 40) * 0.6;
      return (noise + body) * envelope(t, length, 0.004, 9);
    }),
    0.6,
  );
}

function sweep(from: number, to: number, seconds: number, wave: (phase: number) => number) {
  let phase = 0;
  return render(seconds, (t) => {
    const frequency = from + ((to - from) * t) / seconds;
    phase += (TAU * frequency) / SYNTH_RATE;
    return wave(phase) * envelope(t, seconds, 0.005, 3);
  });
}

const sine = (phase: number): number => Math.sin(phase);
const saw = (phase: number): number => ((phase / Math.PI) % 2) - 1;
const triangle = (phase: number): number => 2 * Math.abs(saw(phase)) - 1;

function chime(notes: readonly number[], spacing: number, seconds: number): Float32Array {
  return normalize(
    render(seconds, (t) => {
      let total = 0;
      notes.forEach((frequency, index) => {
        const local = t - index * spacing;
        if (local < 0) return;
        total +=
          (Math.sin(TAU * frequency * local) + 0.3 * Math.sin(TAU * frequency * 2 * local)) *
          Math.exp(-local * 6);
      });
      return total;
    }),
    0.7,
  );
}

/** A pad chord: slow attack, soft detuned triangle and sine voices. */
function pad(frequencies: readonly number[], t: number, length: number): number {
  const attack = Math.min(1, t / 0.8);
  const release = Math.min(1, (length - t) / 0.8);
  let total = 0;
  for (const frequency of frequencies) {
    total += Math.sin(TAU * frequency * t) * 0.5;
    total += Math.sin(TAU * frequency * 1.003 * t + 0.4) * 0.3;
    total += triangle(TAU * frequency * 0.5 * t) * 0.15;
  }
  return (total / frequencies.length) * attack * release;
}

function music(
  chords: readonly (readonly number[])[],
  chordSeconds: number,
  arpeggio: boolean,
  pulse: boolean,
): Float32Array {
  const total = chords.length * chordSeconds;
  const low = lowPass(2400);
  const samples = render(total, (t) => {
    const chordIndex = Math.min(chords.length - 1, Math.floor(t / chordSeconds));
    const local = t - chordIndex * chordSeconds;
    const chord = chords[chordIndex] ?? [];
    let value = pad(chord, local, chordSeconds) * 0.5;
    if (arpeggio) {
      const step = 0.25;
      const index = Math.floor(local / step);
      const note = (chord[index % chord.length] ?? 220) * 2;
      const inStep = local - index * step;
      value += Math.sin(TAU * note * inStep) * Math.exp(-inStep * 9) * 0.22;
    }
    if (pulse) {
      const beat = 0.5;
      const inBeat = local % beat;
      value += Math.sin(TAU * 60 * inBeat) * Math.exp(-inBeat * 14) * 0.5;
    }
    return low(value);
  });
  return normalize(samples, 0.6);
}

const NOTE: Readonly<Record<string, number>> = {
  A2: 110,
  C3: 130.81,
  D3: 146.83,
  E3: 164.81,
  F3: 174.61,
  G3: 196,
  A3: 220,
  C4: 261.63,
  D4: 293.66,
  E4: 329.63,
  F4: 349.23,
  G4: 392,
  A4: 440,
  B4: 493.88,
  C5: 523.25,
};

function chord(...names: string[]): number[] {
  return names.map((name) => NOTE[name] ?? 220);
}

/**
 * Makes a built-in sound as mono samples at {@link SYNTH_RATE}. The same name always gives the
 * same samples, so there is nothing to download and nothing third-party in the game.
 */
export function synthesize(name: BuiltinSound): Float32Array {
  switch (name) {
    case 'footstep':
      return footstep(11, 900, 110, 0.14);
    case 'footstep-grass':
      return footstep(12, 2600, 0, 0.12);
    case 'footstep-stone':
      return footstep(13, 1500, 160, 0.1);
    case 'footstep-sand':
      return footstep(14, 4200, 0, 0.16);
    case 'footstep-wood':
      return footstep(15, 1100, 220, 0.12);
    case 'jump':
      return normalize(sweep(260, 620, 0.2, sine), 0.6);
    case 'land':
      return normalize(
        render(0.25, (t) => {
          const noise = (seededRandom(Math.floor(t * 4000) + 3)() * 2 - 1) * 0.5;
          return (Math.sin(TAU * (110 - 55 * t) * t) + noise * 0.4) * envelope(t, 0.25, 0.003, 8);
        }),
        0.7,
      );
    case 'hurt':
      return normalize(sweep(420, 140, 0.32, saw), 0.55);
    case 'win':
      return chime(
        [NOTE['C4'] ?? 261, NOTE['E4'] ?? 329, NOTE['G4'] ?? 392, NOTE['C5'] ?? 523],
        0.14,
        0.9,
      );
    case 'coin':
      return chime([NOTE['B4'] ?? 493, (NOTE['E4'] ?? 329) * 2], 0.07, 0.4);
    case 'click':
      return normalize(
        render(0.05, (t) => Math.sin(TAU * 1500 * t) * envelope(t, 0.05, 0.001, 8)),
        0.4,
      );
    case 'hit': {
      const random = seededRandom(21);
      const filter = lowPass(1800);
      return normalize(
        render(
          0.18,
          (t) =>
            (Math.sin(TAU * 140 * t) * 0.7 + filter(random() * 2 - 1)) *
            envelope(t, 0.18, 0.002, 9),
        ),
        0.75,
      );
    }
    case 'whoosh': {
      const random = seededRandom(22);
      const filter = lowPass(1400);
      return normalize(
        render(0.3, (t) => filter(random() * 2 - 1) * Math.sin((Math.PI * t) / 0.3) ** 2),
        0.5,
      );
    }
    case 'explosion': {
      const random = seededRandom(23);
      const filter = lowPass(700);
      return normalize(
        render(1.1, (t) => {
          const cutoffMix = Math.exp(-t * 3);
          return (
            (filter(random() * 2 - 1) * (0.5 + cutoffMix) + Math.sin(TAU * 55 * t) * cutoffMix) *
            envelope(t, 1.1, 0.002, 4.5)
          );
        }),
        0.9,
      );
    }
    case 'splash': {
      const random = seededRandom(24);
      const filter = highPass(900);
      return normalize(
        render(0.5, (t) => filter(random() * 2 - 1) * envelope(t, 0.5, 0.01, 6)),
        0.6,
      );
    }
    case 'ambient-wind': {
      const random = seededRandom(31);
      const filter = lowPass(500);
      return seamless(
        normalize(
          render(
            8,
            (t) =>
              filter(random() * 2 - 1) *
              (0.55 + 0.45 * Math.sin(TAU * 0.17 * t) * Math.sin(TAU * 0.09 * t + 1)),
          ),
          0.5,
        ),
        1,
      );
    }
    case 'ambient-rain': {
      const random = seededRandom(32);
      const filter = highPass(1200);
      const smooth = lowPass(9000);
      return seamless(
        normalize(
          render(6, () => smooth(filter(random() * 2 - 1))),
          0.45,
        ),
        0.8,
      );
    }
    case 'ambient-stream': {
      const random = seededRandom(33);
      const band = lowPass(2200);
      const rumble = highPass(250);
      return seamless(
        normalize(
          render(
            6,
            (t) =>
              rumble(band(random() * 2 - 1)) *
              (0.7 + 0.3 * Math.sin(TAU * 3.1 * t) * Math.sin(TAU * 1.3 * t)),
          ),
          0.5,
        ),
        0.8,
      );
    }
    case 'ambient-night': {
      const random = seededRandom(34);
      const soft = lowPass(300);
      return seamless(
        normalize(
          render(8, (t) => {
            const chirp = Math.sin(TAU * 4300 * t) * Math.max(0, Math.sin(TAU * 11 * t)) ** 3 * 0.5;
            const second =
              Math.sin(TAU * 3900 * t) * Math.max(0, Math.sin(TAU * 8.3 * t + 1)) ** 3 * 0.4;
            return chirp + second + soft(random() * 2 - 1) * 0.35;
          }),
          0.35,
        ),
        1,
      );
    }
    case 'music-calm':
      return seamless(
        music(
          [
            chord('A3', 'C4', 'E4'),
            chord('F3', 'A3', 'C4'),
            chord('C3', 'E3', 'G3'),
            chord('G3', 'D4', 'G4'),
          ],
          4,
          true,
          false,
        ),
        0.8,
      );
    case 'music-adventure':
      return seamless(
        music(
          [
            chord('A3', 'C4', 'E4'),
            chord('G3', 'D4', 'G4'),
            chord('F3', 'A3', 'C4'),
            chord('E3', 'G3', 'B4'),
          ],
          2,
          true,
          true,
        ),
        0.5,
      );
  }
}

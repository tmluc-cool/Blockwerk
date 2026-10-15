import { AudioEngine, setAudioSource } from '@blockwerk/runtime';
import type { SoundHandle } from '@blockwerk/runtime';
import { create } from 'zustand';
import { useDocument } from '../state/document';

// Sounds of the project are read from its files, for the games and the previews alike.
setAudioSource((assetId) => {
  const bytes = useDocument.getState().project?.assetBytes(assetId);
  if (!bytes) return null;
  // A copy: decoding hands the buffer to the audio thread.
  return bytes.slice().buffer;
});

/** Whether the Game view is muted (kept across play sessions). */
export const useMute = create<{ muted: boolean; set: (muted: boolean) => void }>()((set) => ({
  muted: false,
  set: (muted) => set({ muted }),
}));

let preview: AudioEngine | null = null;
let playing: SoundHandle | null = null;

/** Plays a sound once for listening (inspector, project window); stops the previous preview. */
export function previewSound(ref: string): void {
  stopPreview();
  preview ??= new AudioEngine();
  preview.resume();
  playing = preview.play(ref, { bus: 'effects' });
}

/** Stops the preview. */
export function stopPreview(): void {
  playing?.stop();
  playing = null;
}

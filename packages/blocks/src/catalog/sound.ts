import { defineBlock } from '../defineBlock';

export const playSound = defineBlock({
  id: 'sound.play',
  category: 'sound',
  shape: 'stack',
  inputs: {
    sound: { type: 'reference', source: 'sound', default: 'builtin:click' },
    where: {
      type: 'dropdown',
      default: 'here',
      options: [
        { value: 'here', text: { de: 'hier', en: 'here' } },
        { value: 'everywhere', text: { de: 'überall', en: 'everywhere' } },
      ],
    },
  },
  text: { de: 'spiele Klang {sound} {where}', en: 'play sound {sound} {where}' },
  keywords: { de: ['ton', 'geräusch', 'effekt'], en: ['audio', 'noise', 'effect', 'sfx'] },
  compile: ({ sound, where }) => `game.playSound(self, ${sound}, ${where});`,
  docs: {
    de: 'Spielt einen Klang einmal. „hier“ ist ein 3D-Klang an der Stelle des Objekts: leiser mit der Entfernung, aus der richtigen Richtung. „überall“ klingt gleich laut, egal wo man ist.',
    en: 'Plays a sound once. "here" is a 3D sound at the object’s position: quieter with distance, from the right direction. "everywhere" sounds equally loud wherever you are.',
  },
  since: 4,
});

export const playMusic = defineBlock({
  id: 'sound.playMusic',
  category: 'sound',
  shape: 'stack',
  inputs: { sound: { type: 'reference', source: 'sound', default: 'builtin:music-calm' } },
  text: { de: 'spiele Musik {sound} in Schleife', en: 'play music {sound} on loop' },
  keywords: { de: ['lied', 'soundtrack'], en: ['song', 'soundtrack', 'loop'] },
  compile: ({ sound }) => `game.playMusic(${sound});`,
  docs: {
    de: 'Spielt Musik in einer Endlosschleife. Läuft schon andere Musik, blendet sie über.',
    en: 'Plays music on an endless loop. If other music is playing, it fades over.',
  },
  since: 4,
});

export const crossfadeMusic = defineBlock({
  id: 'sound.crossfadeMusic',
  category: 'sound',
  shape: 'stack',
  inputs: {
    sound: { type: 'reference', source: 'sound', default: 'builtin:music-adventure' },
    seconds: { type: 'number', default: 3 },
  },
  text: {
    de: 'blende Musik über zu {sound} in {seconds} s',
    en: 'fade music over to {sound} in {seconds} s',
  },
  keywords: { de: ['überblenden', 'wechseln'], en: ['crossfade', 'switch', 'transition'] },
  compile: ({ sound, seconds }) => `game.crossfadeMusic(${sound}, ${seconds});`,
  docs: {
    de: 'Blendet die laufende Musik langsam aus und das neue Stück gleichzeitig ein.',
    en: 'Slowly fades out the music that plays while fading in the new piece.',
  },
  since: 4,
});

export const stopAllSounds = defineBlock({
  id: 'sound.stopAll',
  category: 'sound',
  shape: 'stack',
  inputs: {},
  text: { de: 'stoppe alle Klänge', en: 'stop all sounds' },
  keywords: { de: ['ruhe', 'still', 'aus'], en: ['silence', 'mute', 'off'] },
  compile: () => 'game.stopAllSounds();',
  docs: {
    de: 'Stoppt alle Klänge und die Musik.',
    en: 'Stops all sounds and the music.',
  },
  since: 4,
});

export const setVolume = defineBlock({
  id: 'sound.setVolume',
  category: 'sound',
  shape: 'stack',
  inputs: {
    channel: {
      type: 'dropdown',
      default: 'music',
      options: [
        { value: 'music', text: { de: 'Musik', en: 'music' } },
        { value: 'effects', text: { de: 'Effekte', en: 'effects' } },
        { value: 'voices', text: { de: 'Stimmen', en: 'voices' } },
      ],
    },
    percent: { type: 'number', default: 50 },
  },
  text: {
    de: 'setze Lautstärke {channel} auf {percent} %',
    en: 'set volume {channel} to {percent} %',
  },
  keywords: { de: ['leiser', 'lauter', 'mischpult'], en: ['quieter', 'louder', 'mixer'] },
  compile: ({ channel, percent }) => `game.setVolume(${channel}, ${percent});`,
  docs: {
    de: 'Stellt die Lautstärke eines Kanals ein: Musik, Effekte oder Stimmen (0 bis 100 %).',
    en: 'Sets the volume of a channel: music, effects or voices (0 to 100 %).',
  },
  since: 4,
});

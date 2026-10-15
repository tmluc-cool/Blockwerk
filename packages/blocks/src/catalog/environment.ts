import { defineBlock } from '../defineBlock';

export const setTimeOfDay = defineBlock({
  id: 'environment.setTimeOfDay',
  category: 'environment',
  shape: 'stack',
  inputs: { hours: { type: 'number', default: 12 } },
  text: { de: 'setze Tageszeit auf {hours} Uhr', en: 'set time of day to {hours} o’clock' },
  keywords: { de: ['uhrzeit', 'nacht', 'tag', 'sonne'], en: ['clock', 'night', 'day', 'sun'] },
  areas: ['environment'],
  compile: ({ hours }) => `game.setTimeOfDay(${hours});`,
  docs: {
    de: 'Stellt die Uhrzeit des Himmels ein (0 bis 24, 12 ist Mittag). Sonne, Mond, Sterne, Licht und Nebel folgen.',
    en: 'Sets the time of the sky (0 to 24, 12 is noon). Sun, moon, stars, light and fog follow.',
  },
  since: 4,
});

export const setTimeSpeed = defineBlock({
  id: 'environment.setTimeSpeed',
  category: 'environment',
  shape: 'stack',
  inputs: { factor: { type: 'number', default: 720 } },
  text: { de: 'lasse Zeit laufen mit Faktor {factor}', en: 'let time run with factor {factor}' },
  keywords: { de: ['tag-nacht', 'zeitraffer'], en: ['day-night', 'time lapse', 'speed'] },
  areas: ['environment'],
  compile: ({ factor }) => `game.setTimeSpeed(${factor});`,
  docs: {
    de: 'Lässt die Tageszeit laufen. Faktor 1 ist Echtzeit, 720 macht einen Tag in zwei Minuten, 0 hält die Zeit an.',
    en: 'Lets the time of day run. Factor 1 is real time, 720 makes a day in two minutes, 0 stops the time.',
  },
  since: 4,
});

export const timeOfDay = defineBlock({
  id: 'environment.timeOfDay',
  category: 'environment',
  shape: 'reporter',
  output: 'number',
  inputs: {},
  text: { de: 'Tageszeit (Uhr)', en: 'time of day (hours)' },
  keywords: { de: ['uhrzeit'], en: ['clock'] },
  areas: ['environment'],
  compile: () => 'game.timeOfDay()',
  docs: {
    de: 'Die aktuelle Tageszeit, 0 bis 24.',
    en: 'The current time of day, 0 to 24.',
  },
  since: 4,
});

export const setWeather = defineBlock({
  id: 'environment.setWeather',
  category: 'environment',
  shape: 'stack',
  inputs: {
    weather: {
      type: 'dropdown',
      default: 'rain',
      options: [
        { value: 'clear', text: { de: 'klar', en: 'clear' } },
        { value: 'rain', text: { de: 'Regen', en: 'rain' } },
        { value: 'snow', text: { de: 'Schnee', en: 'snow' } },
        { value: 'fog', text: { de: 'Nebel', en: 'fog' } },
      ],
    },
    seconds: { type: 'number', default: 5 },
  },
  text: {
    de: 'setze Wetter auf {weather} in {seconds} s',
    en: 'set weather to {weather} in {seconds} s',
  },
  keywords: { de: ['regen', 'schnee', 'nebel', 'wind'], en: ['rain', 'snow', 'fog', 'storm'] },
  areas: ['environment'],
  compile: ({ weather, seconds }) => `game.setWeather(${weather}, ${seconds});`,
  docs: {
    de: 'Wechselt das Wetter. Es blendet in der angegebenen Zeit über. Regen und Schnee fallen um die Kamera, Licht und Sicht ändern sich.',
    en: 'Changes the weather. It fades over the given time. Rain and snow fall around the camera; light and visibility change.',
  },
  since: 4,
});

export const setWind = defineBlock({
  id: 'environment.setWind',
  category: 'environment',
  shape: 'stack',
  inputs: { speed: { type: 'number', default: 4 }, direction: { type: 'number', default: 90 } },
  text: {
    de: 'setze Wind auf {speed} m/s Richtung {direction} °',
    en: 'set wind to {speed} m/s towards {direction} °',
  },
  keywords: { de: ['luft', 'sturm'], en: ['air', 'gust'] },
  areas: ['environment'],
  compile: ({ speed, direction }) => `game.setWind(${speed}, ${direction});`,
  docs: {
    de: 'Stellt den Wind ein. Er lenkt Regen und Schnee ab. Die Richtung ist ein Kompasswinkel (0 = nach vorn, 90 = nach rechts).',
    en: 'Sets the wind. It bends rain and snow. The direction is a compass angle (0 = forward, 90 = right).',
  },
  since: 4,
});

export const setFogDensity = defineBlock({
  id: 'environment.setFogDensity',
  category: 'environment',
  shape: 'stack',
  inputs: { percent: { type: 'number', default: 30 } },
  text: { de: 'setze Nebeldichte auf {percent} %', en: 'set fog density to {percent} %' },
  keywords: { de: ['sicht', 'dunst'], en: ['mist', 'haze', 'visibility'] },
  areas: ['environment'],
  compile: ({ percent }) => `game.setFogDensity(${percent});`,
  docs: {
    de: 'Stellt die Dichte des Nebels ein: 0 ist kein Nebel, 100 ist sehr dicht.',
    en: 'Sets how thick the fog is: 0 is no fog, 100 is very thick.',
  },
  since: 4,
});

export const setSunBrightness = defineBlock({
  id: 'environment.setSunBrightness',
  category: 'environment',
  shape: 'stack',
  inputs: { percent: { type: 'number', default: 100 } },
  text: { de: 'setze Sonnenhelligkeit auf {percent} %', en: 'set sun brightness to {percent} %' },
  keywords: { de: ['licht', 'dunkel'], en: ['light', 'dark'] },
  areas: ['environment'],
  compile: ({ percent }) => `game.setSunBrightness(${percent});`,
  docs: {
    de: 'Dimmt oder verstärkt die Sonne (100 ist die Stärke aus der Szene).',
    en: 'Dims or boosts the sun (100 is the strength from the scene).',
  },
  since: 4,
});

export const setGraphicsLevel = defineBlock({
  id: 'environment.setGraphicsLevel',
  category: 'environment',
  shape: 'stack',
  inputs: {
    level: {
      type: 'dropdown',
      default: 'high',
      options: [
        { value: 'low', text: { de: 'Niedrig', en: 'low' } },
        { value: 'medium', text: { de: 'Mittel', en: 'medium' } },
        { value: 'high', text: { de: 'Hoch', en: 'high' } },
        { value: 'ultra', text: { de: 'Ultra', en: 'ultra' } },
      ],
    },
  },
  text: { de: 'setze Grafikstufe auf {level}', en: 'set graphics level to {level}' },
  keywords: { de: ['qualität', 'einstellungen'], en: ['quality', 'settings'] },
  areas: ['environment', 'ui'],
  compile: ({ level }) => `game.setGraphicsLevel(${level});`,
  docs: {
    de: 'Wechselt die Grafikstufe, auch während das Spiel läuft (zum Beispiel aus einem Einstellungsmenü).',
    en: 'Switches the graphics level, also while the game runs (for example from a settings menu).',
  },
  since: 4,
});

export const setLight = defineBlock({
  id: 'environment.setLight',
  category: 'environment',
  shape: 'stack',
  inputs: {
    target: { type: 'reference', source: 'object', default: 'self' },
    state: {
      type: 'dropdown',
      default: 'on',
      options: [
        { value: 'on', text: { de: 'ein', en: 'on' } },
        { value: 'off', text: { de: 'aus', en: 'off' } },
      ],
    },
  },
  text: { de: 'schalte Licht {target} {state}', en: 'switch light {target} {state}' },
  keywords: { de: ['lampe', 'fackel'], en: ['lamp', 'torch'] },
  areas: ['environment'],
  compile: ({ target, state }) => `game.setLightEnabled(self, ${target}, ${state} === "on");`,
  docs: {
    de: 'Schaltet die Licht-Komponente eines Objekts ein oder aus.',
    en: 'Switches the light component of an object on or off.',
  },
  since: 4,
});

export const setLightColor = defineBlock({
  id: 'environment.setLightColor',
  category: 'environment',
  shape: 'stack',
  inputs: {
    target: { type: 'reference', source: 'object', default: 'self' },
    color: { type: 'colorField', default: '#ffb35c' },
  },
  text: {
    de: 'setze Lichtfarbe von {target} auf {color}',
    en: 'set light color of {target} to {color}',
  },
  keywords: { de: ['lampe', 'farbe'], en: ['lamp', 'colour'] },
  areas: ['environment'],
  compile: ({ target, color }) => `game.setLightColor(self, ${target}, ${color});`,
  docs: {
    de: 'Ändert die Farbe der Licht-Komponente eines Objekts.',
    en: 'Changes the color of the light component of an object.',
  },
  since: 4,
});

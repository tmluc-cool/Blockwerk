import { defineBlock } from '../defineBlock';

export const switchCamera = defineBlock({
  id: 'camera.switchTo',
  category: 'camera',
  shape: 'stack',
  inputs: {
    view: {
      type: 'dropdown',
      default: 'thirdPerson',
      options: [
        { value: 'thirdPerson', text: { de: 'Third-Person', en: 'third person' } },
        { value: 'firstPerson', text: { de: 'First-Person', en: 'first person' } },
        { value: 'topDown', text: { de: 'Draufsicht', en: 'top down' } },
        { value: 'side', text: { de: 'Seitenansicht', en: 'side view' } },
        { value: 'fixed', text: { de: 'feste Kamera', en: 'fixed camera' } },
        { value: 'shared', text: { de: 'gemeinsame Kamera', en: 'shared camera' } },
      ],
    },
  },
  text: { de: 'wechsle Kamera zu {view}', en: 'switch camera to {view}' },
  keywords: { de: ['ansicht', 'perspektive'], en: ['view', 'perspective'] },
  areas: ['player'],
  compile: ({ view }) => `game.switchCamera(${view});`,
  docs: {
    de: 'Schaltet auf die Kamera mit diesem Verhalten um, weich überblendet. Die anderen Kameras des Spielers werden ausgeschaltet.',
    en: 'Switches to the camera with this behavior, with a smooth transition. The other cameras of the player are turned off.',
  },
  since: 3,
});

export const switchCameraToObject = defineBlock({
  id: 'camera.switchToObject',
  category: 'camera',
  shape: 'stack',
  inputs: { target: { type: 'reference', source: 'object', default: 'self' } },
  text: { de: 'wechsle Kamera zu Kamera von {target}', en: 'switch camera to camera of {target}' },
  keywords: { de: ['kamera-objekt'], en: ['camera object'] },
  areas: ['player'],
  compile: ({ target }) => `game.switchCameraTo(self, ${target});`,
  docs: {
    de: 'Schaltet auf die Kamera eines anderen Objekts um, weich überblendet.',
    en: 'Switches to the camera of another object, with a smooth transition.',
  },
  since: 3,
});

export const setCameraDistance = defineBlock({
  id: 'camera.setDistance',
  category: 'camera',
  shape: 'stack',
  inputs: { distance: { type: 'number', default: 6 } },
  text: { de: 'setze Kamera-Abstand auf {distance}', en: 'set camera distance to {distance}' },
  keywords: { de: ['zoom', 'entfernung'], en: ['zoom', 'range'] },
  areas: ['player'],
  compile: ({ distance }) => `game.setCameraDistance(self, ${distance});`,
  docs: {
    de: 'Ändert den Abstand der Kamera zum Ziel (in Metern).',
    en: 'Changes the distance of the camera to its target (in meters).',
  },
  since: 3,
});

export const shakeCamera = defineBlock({
  id: 'camera.shake',
  category: 'camera',
  shape: 'stack',
  inputs: { strength: { type: 'number', default: 2 }, seconds: { type: 'number', default: 0.4 } },
  text: {
    de: 'Kamera wackeln Stärke {strength} Dauer {seconds} s',
    en: 'shake camera strength {strength} for {seconds} s',
  },
  keywords: { de: ['beben', 'erschütterung'], en: ['screen shake', 'rumble'] },
  areas: ['player'],
  compile: ({ strength, seconds }) => `game.shakeCamera(self, ${strength}, ${seconds});`,
  docs: {
    de: 'Lässt die Kamera kurz wackeln. Die Stärke ist ein Winkel in Grad und klingt bis zum Ende ab.',
    en: 'Shakes the camera briefly. The strength is an angle in degrees and fades out until the end.',
  },
  since: 3,
});

export const playCameraPath = defineBlock({
  id: 'camera.playPath',
  category: 'camera',
  shape: 'stack',
  inputs: { target: { type: 'reference', source: 'object', default: 'self' } },
  text: { de: 'Kamerafahrt {target} abspielen', en: 'play camera path {target}' },
  keywords: {
    de: ['film', 'wegpunkte', 'zwischensequenz'],
    en: ['dolly', 'cutscene', 'waypoints'],
  },
  areas: ['player'],
  compile: ({ target }) => `game.playCameraPath(self, ${target});`,
  docs: {
    de: 'Schaltet auf das Objekt mit der Komponente „Kamerafahrt“ um und spielt sie von vorn ab.',
    en: 'Switches to the object with the Camera Path component and plays it from the start.',
  },
  since: 3,
});

export const setFieldOfView = defineBlock({
  id: 'camera.setFieldOfView',
  category: 'camera',
  shape: 'stack',
  inputs: { fov: { type: 'number', default: 75 }, seconds: { type: 'number', default: 1 } },
  text: {
    de: 'setze Sichtfeld auf {fov} in {seconds} s',
    en: 'set field of view to {fov} in {seconds} s',
  },
  keywords: { de: ['fov', 'weitwinkel'], en: ['fov', 'zoom'] },
  areas: ['player'],
  compile: ({ fov, seconds }) => `game.setFieldOfView(self, ${fov}, ${seconds});`,
  docs: {
    de: 'Ändert das Sichtfeld der Kamera (in Grad) weich innerhalb der angegebenen Zeit.',
    en: "Changes the camera's field of view (in degrees) smoothly over the given time.",
  },
  since: 3,
});

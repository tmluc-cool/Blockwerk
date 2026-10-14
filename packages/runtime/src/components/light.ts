import { Color, DirectionalLight, PointLight, SpotLight } from 'three';
import type { Light as ThreeLight } from 'three';
import { defineComponent } from './defineComponent';

/** Light (Unity: Light). The first directional light is the sun of the sky. */
export const light = defineComponent({
  type: 'light',
  category: 'rendering',
  unique: true,
  unity: 'Light',
  text: { de: 'Licht', en: 'Light' },
  docs: {
    de: 'Beleuchtet die Szene. Ein gerichtetes Licht ist die Sonne und bestimmt den Himmel.',
    en: 'Lights the scene. A directional light is the sun and drives the sky.',
  },
  keywords: { de: ['sonne', 'lampe'], en: ['sun', 'lamp'] },
  fields: {
    lightType: {
      type: 'enum',
      default: 'directional',
      options: [
        { value: 'directional', text: { de: 'Gerichtet (Sonne)', en: 'Directional' } },
        { value: 'point', text: { de: 'Punkt', en: 'Point' } },
        { value: 'spot', text: { de: 'Spot', en: 'Spot' } },
      ],
      text: { de: 'Typ', en: 'Type' },
    },
    color: { type: 'color', default: '#fff1de', text: { de: 'Farbe', en: 'Color' } },
    intensity: {
      type: 'number',
      default: 4.6,
      min: 0,
      step: 0.1,
      text: { de: 'Stärke', en: 'Intensity' },
    },
    range: {
      type: 'number',
      default: 10,
      min: 0,
      step: 0.5,
      unit: 'meters',
      text: { de: 'Reichweite', en: 'Range' },
    },
    spotAngle: {
      type: 'number',
      default: 30,
      min: 1,
      max: 179,
      step: 1,
      unit: 'degrees',
      text: { de: 'Spot-Winkel', en: 'Spot Angle' },
    },
    castShadows: {
      type: 'boolean',
      default: true,
      text: { de: 'Wirft Schatten', en: 'Cast Shadows' },
    },
  },
  create({ object, world }) {
    let own: ThreeLight | null = null;
    let isSun = false;
    let enabled = true;
    const release = (): void => {
      if (isSun) world.releaseSun(object);
      isSun = false;
      if (own) {
        own.removeFromParent();
        own.dispose();
        own = null;
      }
    };
    const behavior = {
      apply(values: {
        lightType: string;
        color: string;
        intensity: number;
        range: number;
        spotAngle: number;
        castShadows: boolean;
      }) {
        release();
        if (values.lightType === 'directional' && world.claimSun(object)) {
          isSun = true;
          const sun = world.environment.sun;
          sun.color = new Color(values.color);
          sun.intensity = enabled ? values.intensity : 0;
          sun.castShadow = values.castShadows;
          return;
        }
        let created: ThreeLight;
        if (values.lightType === 'point') {
          created = new PointLight(values.color, values.intensity, values.range, 2);
        } else if (values.lightType === 'spot') {
          const spot = new SpotLight(
            values.color,
            values.intensity,
            values.range,
            (values.spotAngle * Math.PI) / 360,
            0.3,
            2,
          );
          // Spot lights shine along the object's forward axis (+Z).
          spot.target.position.set(0, 0, 1);
          spot.add(spot.target);
          created = spot;
        } else {
          const directional = new DirectionalLight(values.color, values.intensity);
          directional.position.set(0, 0, -1);
          directional.target.position.set(0, 0, 0);
          directional.add(directional.target);
          created = directional;
        }
        created.castShadow = values.castShadows && values.lightType !== 'directional';
        created.visible = enabled;
        object.object3d.add(created);
        own = created;
      },
      setEnabled(value: boolean) {
        enabled = value;
        if (own) own.visible = value;
        if (isSun) world.environment.sun.visible = value;
      },
      destroy: release,
    };
    return behavior;
  },
});

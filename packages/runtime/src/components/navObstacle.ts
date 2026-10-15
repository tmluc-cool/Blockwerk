import { defineComponent } from './defineComponent';
import type { FieldDefinitions } from './defineComponent';

const fields = {
  mode: {
    type: 'enum',
    default: 'obstacle',
    options: [
      { value: 'obstacle', text: { de: 'Hindernis (Box)', en: 'Obstacle (box)' } },
      { value: 'ignore', text: { de: 'Ignorieren', en: 'Ignore' } },
    ],
    text: { de: 'Modus', en: 'Mode' },
  },
  center: {
    type: 'vector3',
    default: [0, 0.5, 0],
    unit: 'meters',
    text: { de: 'Mitte', en: 'Center' },
  },
  size: {
    type: 'vector3',
    default: [1, 1, 1],
    unit: 'meters',
    text: { de: 'Grösse', en: 'Size' },
  },
} as const satisfies FieldDefinitions;

/**
 * Nav Obstacle (Unity: NavMeshObstacle / Navigation Static): adds a box to the navigation mesh
 * (agents walk around it) or leaves the object's colliders out of it. The component itself does
 * nothing at runtime; the navigation mesh reads its fields when it is built.
 */
export const navObstacle = defineComponent({
  type: 'navObstacle',
  category: 'gameplay',
  unique: true,
  unity: 'NavMeshObstacle',
  text: { de: 'Nav-Hindernis', en: 'Nav Obstacle' },
  docs: {
    de: 'Legt fest, wie das Objekt in das Navigationsnetz eingeht: als zusätzliche Box, um die Agenten herumlaufen, oder gar nicht („Ignorieren“, etwa für Zierrat, der im Weg liegt, aber nicht blockiert). Ohne diese Komponente zählen die festen Collider des Objekts.',
    en: 'Decides how the object enters the navigation mesh: as an extra box agents walk around, or not at all ("Ignore", e.g. for decoration that lies in the way but does not block). Without this component the object’s static colliders count.',
  },
  keywords: {
    de: ['navigation', 'hindernis', 'blockiert', 'ki'],
    en: ['navigation', 'obstacle', 'blocks', 'carve', 'ai'],
  },
  fields,
  create() {
    return {
      apply() {},
      destroy() {},
    };
  },
});

import { defineBlock } from '../defineBlock';

export const goToPath = defineBlock({
  id: 'npc.goTo',
  category: 'npc',
  shape: 'stack',
  inputs: { target: { type: 'reference', source: 'object', default: 'tag:Player' } },
  text: { de: 'gehe zu {target} (Wegfindung)', en: 'go to {target} (pathfinding)' },
  keywords: {
    de: ['laufen', 'weg', 'navigation', 'ki', 'ziel'],
    en: ['walk', 'path', 'navigation', 'ai', 'destination', 'navmesh'],
  },
  areas: ['npc'],
  compile: ({ target }) => `yield* game.navigateTo(self, ${target});`,
  docs: {
    de: 'Der NPC läuft über das Navigationsnetz zu einem Objekt, um Hindernisse herum, und das Skript wartet, bis er angekommen ist. Braucht eine Nav-Agent-Komponente (Unity: NavMeshAgent.SetDestination).',
    en: 'The NPC walks over the navigation mesh to an object, around obstacles, and the script waits until it has arrived. Needs a Nav Agent component (Unity: NavMeshAgent.SetDestination).',
  },
  since: 5,
});

export const followTarget = defineBlock({
  id: 'npc.follow',
  category: 'npc',
  shape: 'stack',
  inputs: {
    target: { type: 'reference', source: 'object', default: 'tag:Player' },
    distance: { type: 'number', default: 2 },
  },
  text: {
    de: 'folge {target} mit Abstand {distance}',
    en: 'follow {target} at distance {distance}',
  },
  keywords: { de: ['hinterher', 'verfolgen', 'ki'], en: ['chase', 'pursue', 'ai', 'companion'] },
  areas: ['npc'],
  compile: ({ target, distance }) => `game.followTarget(self, ${target}, ${distance});`,
  docs: {
    de: 'Der NPC läuft ab jetzt dem Objekt hinterher und bleibt im Abstand (in Metern) stehen. „Bleib stehen“ oder ein anderer Bewegungsblock beendet das. Bei einem Tag läuft er dem nächsten Objekt nach.',
    en: 'From now on the NPC runs after the object and stops at the distance (in meters). "Stand still" or another movement block ends it. With a tag it follows the nearest object.',
  },
  since: 5,
});

export const fleeFrom = defineBlock({
  id: 'npc.flee',
  category: 'npc',
  shape: 'stack',
  inputs: { target: { type: 'reference', source: 'object', default: 'tag:Player' } },
  text: { de: 'fliehe vor {target}', en: 'flee from {target}' },
  keywords: { de: ['weglaufen', 'angst', 'ki'], en: ['run away', 'afraid', 'ai', 'escape'] },
  areas: ['npc'],
  compile: ({ target }) => `game.fleeFrom(self, ${target});`,
  docs: {
    de: 'Der NPC läuft vom Objekt weg, bis er weit genug entfernt ist. „Bleib stehen“ beendet das.',
    en: 'The NPC runs away from the object until it is far enough away. "Stand still" ends it.',
  },
  since: 5,
});

export const wanderAround = defineBlock({
  id: 'npc.wander',
  category: 'npc',
  shape: 'stack',
  inputs: { radius: { type: 'number', default: 8 } },
  text: { de: 'wandere herum in Radius {radius}', en: 'wander around within radius {radius}' },
  keywords: { de: ['herumlaufen', 'spazieren', 'ki'], en: ['roam', 'idle walk', 'ai'] },
  areas: ['npc'],
  compile: ({ radius }) => `game.wanderAround(self, ${radius});`,
  docs: {
    de: 'Der NPC läuft immer wieder zu zufälligen Punkten im Umkreis (in Metern) um den Platz, an dem er jetzt steht.',
    en: 'The NPC keeps walking to random points within the radius (in meters) around the place where it stands now.',
  },
  since: 5,
});

export const patrolRoute = defineBlock({
  id: 'npc.patrol',
  category: 'npc',
  shape: 'stack',
  inputs: { route: { type: 'reference', source: 'object', default: 'self' } },
  text: { de: 'patrouilliere entlang {route}', en: 'patrol along {route}' },
  keywords: { de: ['wegpunkte', 'route', 'wache'], en: ['waypoints', 'route', 'guard'] },
  areas: ['npc'],
  compile: ({ route }) => `game.patrolRoute(self, ${route});`,
  docs: {
    de: 'Der NPC läuft die Kinder des Objekts als Wegpunkte ab, in der Reihenfolge der Hierarchie, im Kreis.',
    en: 'The NPC walks the object’s children as waypoints, in hierarchy order, around and around.',
  },
  since: 5,
});

export const standStill = defineBlock({
  id: 'npc.stop',
  category: 'npc',
  shape: 'stack',
  inputs: {},
  text: { de: 'bleib stehen', en: 'stand still' },
  keywords: { de: ['anhalten', 'stopp', 'warten'], en: ['halt', 'stop walking', 'idle'] },
  areas: ['npc'],
  compile: () => 'game.stopWalking(self);',
  docs: {
    de: 'Der NPC bleibt stehen und beendet Folgen, Fliehen, Wandern und Patrouille, die mit Blöcken gestartet wurden.',
    en: 'The NPC stops and ends Follow, Flee, Wander and Patrol started with blocks.',
  },
  since: 5,
});

export const whenState = defineBlock({
  id: 'npc.whenState',
  category: 'npc',
  shape: 'hat',
  inputs: { state: { type: 'textField', default: 'chase' } },
  text: { de: 'Wenn Zustand {state}', en: 'when state {state}' },
  keywords: { de: ['zustand', 'wechsel', 'ki'], en: ['state', 'change', 'ai', 'fsm'] },
  areas: ['npc'],
  event: ({ state }) => ({ type: 'state', params: { state } }),
  docs: {
    de: 'Startet das Skript, sobald der NPC in diesen Zustand wechselt (Unity: ein Animator-Zustand betreten).',
    en: 'Runs the script as soon as the NPC changes into this state (Unity: entering an Animator state).',
  },
  since: 5,
});

export const setState = defineBlock({
  id: 'npc.setState',
  category: 'npc',
  shape: 'stack',
  inputs: { state: { type: 'textField', default: 'patrol' } },
  text: { de: 'wechsle Zustand zu {state}', en: 'change state to {state}' },
  keywords: { de: ['zustand', 'ki', 'verhalten'], en: ['state', 'ai', 'behavior', 'fsm'] },
  areas: ['npc'],
  compile: ({ state }) => `game.setNpcState(self, ${state});`,
  docs: {
    de: 'Setzt den Zustand des NPCs. Seine Verhaltens-Komponenten laufen nur in ihrem Zustand (Patrouille in „patrol“, Folgen in „chase“ …).',
    en: 'Sets the NPC’s state. Its behavior components run only in their state (Patrol in "patrol", Follow in "chase" …).',
  },
  since: 5,
});

export const currentState = defineBlock({
  id: 'npc.state',
  category: 'npc',
  shape: 'reporter',
  output: 'string',
  inputs: {},
  text: { de: 'aktueller Zustand', en: 'current state' },
  keywords: { de: ['zustand'], en: ['state'] },
  areas: ['npc'],
  compile: () => 'game.npcState(self)',
  docs: {
    de: 'Der Name des Zustands, in dem der NPC gerade ist (leer, wenn er keinen hat).',
    en: 'The name of the state the NPC is in now (empty if it has none).',
  },
  since: 5,
});

export const seesTarget = defineBlock({
  id: 'npc.sees',
  category: 'npc',
  shape: 'boolean',
  output: 'boolean',
  inputs: { target: { type: 'reference', source: 'object', default: 'tag:Player' } },
  text: { de: 'sehe ich {target}?', en: 'do I see {target}?' },
  keywords: { de: ['sicht', 'sichtkegel', 'wache'], en: ['sight', 'vision', 'cone', 'guard'] },
  areas: ['npc'],
  compile: ({ target }) => `game.sees(self, ${target})`,
  docs: {
    de: 'Wahr, wenn das Objekt im Sichtkegel des NPCs ist und keine Wand dazwischen steht. Die Werte (Sichtweite, Winkel) kommen von der Wache-Komponente.',
    en: 'True if the object is in the NPC’s view cone with no wall in between. The values (distance, angle) come from the Guard component.',
  },
  since: 5,
});

export const hearsTarget = defineBlock({
  id: 'npc.hears',
  category: 'npc',
  shape: 'boolean',
  output: 'boolean',
  inputs: { target: { type: 'reference', source: 'object', default: 'tag:Player' } },
  text: { de: 'höre ich {target}?', en: 'do I hear {target}?' },
  keywords: { de: ['hören', 'geräusch', 'wache'], en: ['hearing', 'noise', 'guard'] },
  areas: ['npc'],
  compile: ({ target }) => `game.hears(self, ${target})`,
  docs: {
    de: 'Wahr, wenn das Objekt innerhalb der Hörweite des NPCs ist (auch hinter Wänden).',
    en: 'True if the object is within the NPC’s hearing radius (also behind walls).',
  },
  since: 5,
});

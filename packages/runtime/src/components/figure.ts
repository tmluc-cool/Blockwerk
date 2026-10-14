import { mapBones, retargetClip, rigFromObject } from '@blockwerk/character';
import type { BoneMapping, MappedRig } from '@blockwerk/character';
import { Box3, Color, MathUtils, Vector3 } from 'three';
import type { AnimationClip, Material, Mesh, Object3D } from 'three';
import { ANIMATION_STATES, matchClips } from '../animation/states';
import { PROFILE_NAMES, PROFILE_TEXT } from '../character/movement';
import { ModelCache } from '../models/ModelCache';
import type { ModelTemplate } from '../models/ModelCache';
import { controlRegistry } from './controls';
import { defineComponent } from './defineComponent';
import { renderedModels } from './meshRenderer';

/** Library character whose animations every humanoid figure can use (SPEC 8.7). */
export const DEFAULT_ANIMATION_SOURCE = 'library:kaykit-adventurers/knight';

/** Where an item can be attached (SPEC 5.10 "Halte-Punkte"). */
export const ATTACHMENT_POINTS = ['rightHand', 'leftHand', 'back', 'head', 'hip'] as const;
export type AttachmentPoint = (typeof ATTACHMENT_POINTS)[number];

/** What the figure knows about its model (read by the Character Studio and by blocks). */
export interface FigureInfo {
  /** `skeleton`: humanoid skeleton found; `rigid`: no usable skeleton (lively bobbing). */
  readonly mode: 'skeleton' | 'rigid';
  /** Names of all mesh nodes of the model. */
  readonly parts: readonly string[];
  /** Mesh nodes without skin: usually gear (swords, shields, capes, helmets). */
  readonly gear: readonly string[];
  /** The recognized bones. */
  readonly mapping: BoneMapping | null;
  /** Height of the model before scaling, in meters. */
  readonly naturalHeight: number;
  readonly root: Object3D;
  /** Items attached right now, by attachment point. */
  readonly attached: ReadonlyMap<string, Object3D>;
}

/** Figures by object. */
export const figureRegistry = new WeakMap<object, FigureInfo>();

/** `a=b;c=d` → pairs. */
export function parseList(text: string): [string, string][] {
  return text
    .split(';')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .flatMap((entry) => {
      const split = entry.lastIndexOf('=');
      return split > 0
        ? ([[entry.slice(0, split).trim(), entry.slice(split + 1).trim()]] as [string, string][])
        : [];
    });
}

/** Attachments are written as `item@point;item@point`. */
export function parseAttachments(text: string): [string, string][] {
  return text
    .split(';')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .flatMap((entry) => {
      const split = entry.lastIndexOf('@');
      return split > 0
        ? ([[entry.slice(0, split).trim(), entry.slice(split + 1).trim()]] as [string, string][])
        : [];
    });
}

/** Height of the visible, non-gear meshes of a model. */
function bodyBounds(root: Object3D, gear: ReadonlySet<string>, hidden: ReadonlySet<string>): Box3 {
  const box = new Box3();
  root.updateWorldMatrix(true, true);
  root.traverse((node) => {
    const mesh = node as Mesh;
    if (!mesh.isMesh || gear.has(node.name) || hidden.has(node.name)) return;
    box.union(new Box3().setFromObject(mesh));
  });
  return box;
}

/** The node an item hangs from, and where on it. */
function attachmentNode(
  root: Object3D,
  info: { mapping: BoneMapping | null; mode: 'skeleton' | 'rigid' },
  point: string,
  height: number,
): { node: Object3D; position: Vector3 } {
  const find = (name: string | undefined): Object3D | undefined =>
    name ? root.getObjectByName(name) : undefined;
  const map = info.mapping?.map ?? {};
  const slot = (side: 'r' | 'l'): Object3D | undefined => {
    let found: Object3D | undefined;
    root.traverse((node) => {
      const lower = node.name.toLowerCase();
      if (
        !found &&
        lower.includes('handslot') &&
        /(^|[^a-z])[lr]$|[lr]$/.test(lower) &&
        lower.endsWith(side)
      ) {
        found = node;
      }
    });
    return found;
  };
  const zero = new Vector3();
  if (info.mode === 'skeleton') {
    switch (point) {
      case 'rightHand': {
        const node = slot('r') ?? find(map['rightHand']);
        if (node) return { node, position: zero };
        break;
      }
      case 'leftHand': {
        const node = slot('l') ?? find(map['leftHand']);
        if (node) return { node, position: zero };
        break;
      }
      case 'back': {
        const node = find(map['upperChest'] ?? map['chest'] ?? map['spine']);
        if (node) return { node, position: new Vector3(0, 0.05, -0.18) };
        break;
      }
      case 'head': {
        const node = find(map['head']);
        if (node) return { node, position: new Vector3(0, 0.18, 0) };
        break;
      }
      case 'hip': {
        const node = find(map['hips']);
        if (node) return { node, position: new Vector3(0.22, -0.05, 0) };
        break;
      }
    }
  }
  // Rigid figures (or a missing bone): hang the item on the model at a body-like place.
  const places: Record<string, Vector3> = {
    rightHand: new Vector3(-0.4, height * 0.5, 0.1),
    leftHand: new Vector3(0.4, height * 0.5, 0.1),
    back: new Vector3(0, height * 0.65, -0.25),
    head: new Vector3(0, height * 0.98, 0),
    hip: new Vector3(0.25, height * 0.5, 0),
  };
  return { node: root, position: places[point] ?? zero };
}

/** Retargeted clips are computed once per model, donor and bone map. */
const retargeted = new Map<string, AnimationClip[]>();

/**
 * Figure (SPEC 5.10): shows a character model scaled to a body height, with parts that can be
 * hidden and tinted, items attached to the hands, back, head or hip, and animations. A humanoid
 * skeleton is recognized automatically; the standard animations of the library are transferred
 * to it (retargeting). Models without a skeleton move like a lively rigid body.
 */
export const character = defineComponent({
  type: 'character',
  category: 'gameplay',
  unique: true,
  text: { de: 'Figur', en: 'Character' },
  docs: {
    de: 'Eine Spielfigur: Modell mit Körpergrösse, ausblendbaren und einfärbbaren Teilen, Ausrüstung an Halte-Punkten und Animationen. Humanoide Skelette werden erkannt, die Standard-Animationen der Bibliothek funktionieren auf ihnen. Modelle ohne Skelett wippen und neigen sich beim Laufen.',
    en: 'A game character: a model with a body height, parts that can be hidden and tinted, items on attachment points and animations. Humanoid skeletons are recognized and the standard animations of the library work on them. Models without a skeleton bob and lean while moving.',
  },
  keywords: {
    de: ['figur', 'held', 'avatar', 'spieler', 'npc'],
    en: ['character', 'avatar', 'hero', 'player', 'npc'],
  },
  fields: {
    model: {
      type: 'asset',
      default: null,
      assetType: 'model',
      text: { de: 'Modell', en: 'Model' },
    },
    bodyHeight: {
      type: 'number',
      default: 1.8,
      min: 0,
      step: 0.05,
      unit: 'meters',
      text: { de: 'Körpergrösse (0 = Originalgrösse)', en: 'Body Height (0 = original size)' },
    },
    profile: {
      type: 'enum',
      default: 'custom',
      options: [
        { value: 'custom', text: { de: 'Eigene Werte', en: 'Custom' } },
        ...PROFILE_NAMES.map((value) => ({ value, text: PROFILE_TEXT[value] })),
      ],
      text: { de: 'Bewegungs-Profil', en: 'Movement Profile' },
    },
    hiddenParts: {
      type: 'string',
      default: '',
      group: 'parts',
      text: { de: 'Ausgeblendete Teile (mit ; getrennt)', en: 'Hidden Parts (separated by ;)' },
    },
    tints: {
      type: 'string',
      default: '',
      group: 'parts',
      text: { de: 'Farben (Teil=#rrggbb; …)', en: 'Colors (Part=#rrggbb; …)' },
    },
    attachments: {
      type: 'string',
      default: '',
      group: 'parts',
      text: { de: 'Ausrüstung (Modell@Punkt; …)', en: 'Equipment (model@point; …)' },
    },
    libraryAnimations: {
      type: 'boolean',
      default: true,
      group: 'animation',
      text: {
        de: 'Bibliotheks-Animationen übertragen',
        en: 'Transfer Library Animations',
      },
    },
    animationSource: {
      type: 'asset',
      default: null,
      assetType: 'model',
      group: 'animation',
      text: { de: 'Animationen von (leer = Ritter)', en: 'Animations From (empty = Knight)' },
    },
    boneMap: {
      type: 'string',
      default: '',
      group: 'animation',
      text: {
        de: 'Skelett-Zuordnung (Standard=Knochen; …)',
        en: 'Skeleton Map (standard=bone; …)',
      },
    },
    rigidMotion: {
      type: 'boolean',
      default: true,
      group: 'animation',
      text: { de: 'Wippen ohne Skelett', en: 'Bobbing without Skeleton' },
    },
  },
  create({ object, world }) {
    let values = {
      model: null as string | null,
      bodyHeight: 1.8,
      profile: 'custom',
      hiddenParts: '',
      tints: '',
      attachments: '',
      libraryAnimations: true,
      animationSource: null as string | null,
      boneMap: '',
      rigidMotion: true,
    };
    let modelRef: string | null = null;
    let model: Object3D | null = null;
    let template: ModelTemplate | null = null;
    let wrapper: Object3D | null = null;
    let destroyed = false;
    let enabled = true;
    let generation = 0;
    const attached = new Map<string, Object3D>();
    let mode: 'skeleton' | 'rigid' = 'rigid';
    let mapping: BoneMapping | null = null;
    let rig: MappedRig | null = null;
    let naturalHeight = 0;
    let scale = 1;
    let baseY = 0;
    let bobPhase = 0;
    let squash = 0;
    let previousLanding = 1000;
    const tinted = new Map<Mesh, Material | Material[]>();

    const publish = (): void => {
      if (!model) return;
      figureRegistry.set(object, {
        mode,
        parts: meshNodes(model).map((node) => node.name),
        gear: meshNodes(model)
          .filter((node) => !(node as { isSkinnedMesh?: boolean }).isSkinnedMesh)
          .map((node) => node.name),
        mapping,
        naturalHeight,
        root: model,
        attached,
      });
    };
    const meshNodes = (root: Object3D): Mesh[] => {
      const result: Mesh[] = [];
      root.traverse((node) => {
        if ((node as { isMesh?: boolean }).isMesh) result.push(node as Mesh);
      });
      return result;
    };

    const clearTints = (): void => {
      for (const [mesh, material] of tinted) mesh.material = material;
      tinted.clear();
    };
    const removeModel = (): void => {
      generation += 1;
      clearTints();
      for (const item of attached.values()) item.removeFromParent();
      attached.clear();
      wrapper?.removeFromParent();
      wrapper = null;
      model = null;
      template = null;
      rig = null;
      mapping = null;
      figureRegistry.delete(object);
      renderedModels.delete(object);
    };

    /** Hidden parts, tints, size and attachments from the current values. */
    const refresh = (): void => {
      if (!model || !template) return;
      const hidden = new Set(
        values.hiddenParts
          .split(';')
          .map((name) => name.trim())
          .filter(Boolean),
      );
      const meshes = meshNodes(model);
      for (const mesh of meshes) mesh.visible = !hidden.has(mesh.name);
      // Tints: a copy of the material of the part with a color that multiplies its texture.
      clearTints();
      for (const [name, color] of parseList(values.tints)) {
        const mesh = meshes.find((candidate) => candidate.name === name);
        if (!mesh) continue;
        tinted.set(mesh, mesh.material);
        const tint = (material: Material): Material => {
          const copy = material.clone() as Material & { color?: Color };
          copy.color?.set(new Color(color));
          return copy;
        };
        mesh.material = Array.isArray(mesh.material)
          ? mesh.material.map(tint)
          : tint(mesh.material);
      }
      // Size: body height without gear and hidden parts, feet on the ground.
      const gear = new Set(
        mode === 'skeleton'
          ? meshes
              .filter((mesh) => !(mesh as { isSkinnedMesh?: boolean }).isSkinnedMesh)
              .map((m) => m.name)
          : [],
      );
      model.scale.setScalar(1);
      model.position.set(0, 0, 0);
      const box = bodyBounds(model, gear, hidden);
      naturalHeight = box.isEmpty() ? 0 : box.max.y - box.min.y;
      scale = values.bodyHeight > 0 && naturalHeight > 1e-6 ? values.bodyHeight / naturalHeight : 1;
      model.scale.setScalar(scale);
      baseY = box.isEmpty() ? 0 : -box.min.y * scale;
      model.position.y = baseY;
      // Equipment.
      for (const item of attached.values()) item.removeFromParent();
      attached.clear();
      const generationNow = generation;
      for (const [itemRef, point] of parseAttachments(values.attachments)) {
        world.requestModel(itemRef, (itemTemplate) => {
          if (!itemTemplate || destroyed || generationNow !== generation || !model) return;
          const item = ModelCache.instantiate(itemTemplate);
          item.userData['gameObjectId'] = object.id;
          const place = attachmentNode(
            model,
            { mapping, mode },
            point,
            values.bodyHeight || naturalHeight,
          );
          item.position.copy(place.position);
          place.node.add(item);
          const previous = attached.get(point);
          previous?.removeFromParent();
          attached.set(point, item);
          publish();
        });
      }
      publish();
      transferAnimations();
    };

    /** Animations the model does not have come from the library, retargeted to its skeleton. */
    const transferAnimations = (): void => {
      if (!model || !template || mode !== 'skeleton' || !rig || !values.libraryAnimations) {
        if (model && template) renderedModels.set(object, { root: model, template });
        return;
      }
      const own = matchClips(
        template.animations.map((clip) => clip.name),
        template.animationMap,
      );
      const missing = ANIMATION_STATES.filter((state) => !own.has(state));
      const donorRef = values.animationSource ?? DEFAULT_ANIMATION_SOURCE;
      if (missing.length === 0 || donorRef === modelRef) {
        renderedModels.set(object, { root: model, template });
        return;
      }
      const current = generation;
      const currentRoot = model;
      const currentTemplate = template;
      const currentRig = rig;
      renderedModels.set(object, { root: currentRoot, template: currentTemplate });
      world.requestModel(donorRef, (donor) => {
        if (!donor || destroyed || current !== generation) return;
        const key = `${modelRef}|${donorRef}|${values.boneMap}|${missing.join(',')}`;
        let clips = retargeted.get(key);
        if (!clips) {
          const donorRig = rigFromObject(donor.scene);
          const donorMapping = mapBones(donorRig.bones);
          if (!donorMapping.complete) return;
          const donorMapped: MappedRig = { rig: donorRig, map: donorMapping.map };
          const donorStates = matchClips(
            donor.animations.map((clip) => clip.name),
            donor.animationMap,
          );
          const wanted = new Set(
            missing.map((state) => donorStates.get(state)).filter((n): n is string => !!n),
          );
          clips = donor.animations
            .filter((clip) => wanted.has(clip.name))
            .map((clip) => retargetClip(clip, donorMapped, currentRig));
          retargeted.set(key, clips);
        }
        renderedModels.set(object, {
          root: currentRoot,
          template: currentTemplate,
          extraClips: clips,
        });
      });
    };

    const load = (ref: string): void => {
      const current = generation;
      world.requestModel(ref, (loaded) => {
        if (!loaded || destroyed || current !== generation || modelRef !== ref || model) return;
        template = loaded;
        model = ModelCache.instantiate(loaded);
        model.userData['model'] = true;
        model.userData['gameObjectId'] = object.id;
        model.traverse((node) => {
          const mesh = node as Mesh;
          if (mesh.isMesh) {
            mesh.castShadow = true;
            mesh.receiveShadow = true;
          }
        });
        model.visible = enabled && object.visible;
        object.object3d.add(model);
        // Skeleton: recognize the humanoid bones; the user's map wins over the automatic one.
        mode = 'rigid';
        mapping = null;
        rig = null;
        if (loaded.skinned) {
          const found = rigFromObject(model);
          const automatic = mapBones(found.bones);
          const map = {
            ...automatic.map,
            ...loaded.boneMap,
            ...Object.fromEntries(parseList(values.boneMap)),
          };
          const merged: BoneMapping = {
            ...automatic,
            map,
            missing: automatic.missing.filter((name) => !(name in map)),
            complete: automatic.missing.every((name) => name in map),
          };
          mapping = merged;
          if (merged.complete) {
            mode = 'skeleton';
            rig = { rig: found, map };
          }
        }
        refresh();
      });
    };

    return {
      apply(next) {
        const before = values;
        values = next as typeof values;
        if (next.model !== modelRef) {
          removeModel();
          modelRef = next.model;
          if (modelRef) load(modelRef);
          return;
        }
        if (before.boneMap !== next.boneMap && model && template?.skinned) {
          // A changed bone map needs the skeleton recognized again: reload the model.
          removeModel();
          if (modelRef) load(modelRef);
          return;
        }
        refresh();
      },
      setEnabled(value) {
        enabled = value;
        if (model) model.visible = value && object.visible;
      },
      tick(stage, context) {
        if (stage !== 'animate' || !model || mode !== 'rigid' || !values.rigidMotion) return;
        // Lively movement for figures without a skeleton: bobbing, leaning, squash on landing.
        const control = controlRegistry.get(object);
        const speed = control?.speed ?? 0;
        const dt = context.dt;
        bobPhase += speed * dt * 3.2;
        const bob =
          control?.grounded === false
            ? 0
            : Math.abs(Math.sin(bobPhase)) * Math.min(1, speed / 3) * 0.06;
        const lean = MathUtils.clamp((speed / 6) * 0.25, 0, 0.3);
        if (control && control.ticksSinceLanding === 0 && previousLanding !== 0) squash = 0.22;
        previousLanding = control?.ticksSinceLanding ?? 1000;
        squash = Math.max(0, squash - dt * 1.6);
        model.position.y = baseY + bob * scale;
        model.rotation.x = lean;
        const factor = 1 - squash;
        model.scale.set(scale * (1 + squash * 0.5), scale * factor, scale * (1 + squash * 0.5));
      },
      destroy() {
        destroyed = true;
        removeModel();
      },
    };
  },
});

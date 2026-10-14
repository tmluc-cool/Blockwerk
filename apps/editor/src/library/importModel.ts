import { readVrm } from '@blockwerk/character';
import type { LibraryEntry } from '@blockwerk/library';
import { DEFAULT_MODEL_IMPORT_SETTINGS } from '@blockwerk/project';
import type { AssetEntry } from '@blockwerk/project';
import type { Object3D } from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { useConsole } from '../state/console';
import { defaultFolder, importModelAsset } from '../state/document';
import { useSettings } from '../state/settings';
import { libraryUrl } from './assetLibrary';

/** File endings that can be imported as models (SPEC 6.3). */
export const MODEL_FILE_EXTENSIONS = ['.glb', '.gltf', '.vrm', '.fbx', '.obj'] as const;

/** Whether a file name is an importable model. */
export function isModelFile(name: string): boolean {
  const lower = name.toLowerCase();
  return MODEL_FILE_EXTENSIONS.some((extension) => lower.endsWith(extension));
}

/** Writes a three.js scene as a binary glTF (GLB). */
async function toGlb(scene: Object3D): Promise<Uint8Array> {
  const result = await new GLTFExporter().parseAsync(scene, { binary: true, onlyVisible: false });
  if (!(result instanceof ArrayBuffer)) throw new Error('GLB export failed.');
  return new Uint8Array(result);
}

/**
 * Converts a model file to GLB: GLB stays as it is, glTF (with embedded data), FBX and OBJ are
 * loaded with three.js and written as GLB (Unity converts on import as well).
 */
export async function convertToGlb(name: string, data: ArrayBuffer): Promise<Uint8Array> {
  const lower = name.toLowerCase();
  // A VRM avatar is a GLB; its extensions are read for the import settings only.
  if (lower.endsWith('.glb') || lower.endsWith('.vrm')) return new Uint8Array(data);
  if (lower.endsWith('.gltf')) {
    const gltf = await new GLTFLoader().parseAsync(data, '');
    return toGlb(gltf.scene);
  }
  if (lower.endsWith('.fbx')) return toGlb(new FBXLoader().parse(data, ''));
  if (lower.endsWith('.obj')) return toGlb(new OBJLoader().parse(new TextDecoder().decode(data)));
  throw new Error(`Unsupported model file: ${name}`);
}

/** Name of a model file without its ending. */
function baseName(name: string): string {
  return name.replace(/\.[^.]+$/, '');
}

/** Imports model files into a project folder. Returns the new model assets. */
export async function importModelFiles(
  files: readonly File[],
  folder = defaultFolder('model'),
): Promise<AssetEntry<'model'>[]> {
  const imported: AssetEntry<'model'>[] = [];
  for (const file of files) {
    if (!isModelFile(file.name)) continue;
    try {
      const glb = await convertToGlb(file.name, await file.arrayBuffer());
      const vrm = readVrm(glb);
      // VRM: the humanoid assignment goes into the import settings, the license into the meta.
      const entry = vrm
        ? importModelAsset(
            folder,
            baseName(file.name),
            glb,
            {
              ...DEFAULT_MODEL_IMPORT_SETTINGS,
              generateCollider: false,
              boneMap: vrm.boneMap,
              ...(vrm.version === 0 ? { yaw: 180 } : {}),
            },
            vrm.license || null,
          )
        : importModelAsset(folder, baseName(file.name), glb);
      if (entry) {
        imported.push(entry);
        useConsole.getState().log('info', 'console.modelImported', { name: file.name });
      }
    } catch (error) {
      useConsole
        .getState()
        .log('error', 'console.modelImportFailed', { name: file.name, message: String(error) });
    }
  }
  return imported;
}

/**
 * "Import into Project": copies a library model into `Assets/Modelle/` (SPEC 6.1). The copy
 * keeps the CC0 license note; library models are already in meters with the pivot at the bottom.
 */
export async function importLibraryModel(entry: LibraryEntry): Promise<AssetEntry<'model'> | null> {
  try {
    const response = await fetch(libraryUrl(entry.file));
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const glb = new Uint8Array(await response.arrayBuffer());
    const locale = useSettings.getState().locale;
    const created = importModelAsset(
      defaultFolder('model'),
      entry.name[locale],
      glb,
      { ...DEFAULT_MODEL_IMPORT_SETTINGS, generateCollider: entry.collider.type !== 'none' },
      `${entry.license} (${entry.author})`,
    );
    if (created) {
      useConsole
        .getState()
        .log('info', 'assetLibrary.imported', { name: entry.name[locale], path: created.path });
    }
    return created;
  } catch (error) {
    useConsole
      .getState()
      .log('error', 'console.modelImportFailed', { name: entry.id, message: String(error) });
    return null;
  }
}

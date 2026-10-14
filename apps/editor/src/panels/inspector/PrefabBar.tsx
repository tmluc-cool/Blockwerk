import { assetDisplayName, instanceMembers } from '@blockwerk/project';
import type { PrefabOverride, SceneData, SceneObjectData } from '@blockwerk/project';
import { Package } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import {
  applyInstanceOverrides,
  revertInstanceOverrides,
  unpackInstance,
} from '../../document/prefabActions';
import { objectName } from '../../scene/worlds';
import { openPrefab, useDocument } from '../../state/document';
import { useEditor } from '../../state/editor';
import { useT } from '../../state/settings';

/** Readable name of an override: object name and value path. */
function describe(override: PrefabOverride, scene: SceneData | null, rootId: string): string {
  const members = scene ? instanceMembers(scene.objects, rootId) : new Map<string, string>();
  const id = members.get(override.object);
  const object = id ? scene?.objects[id] : undefined;
  const component = /^component:([^:]+):(.+)$/.exec(override.path);
  let path = override.path;
  if (component && object) {
    const type = object.components.find((item) => item.id === component[1])?.type ?? '?';
    path = `${type}.${component[2] ?? ''}`;
  }
  return `${object ? objectName(object, id) : '?'} · ${path}`;
}

/**
 * Prefab bar of the inspector for objects of a prefab instance (Unity: Prefab header with Open,
 * Select and Overrides): open the prefab, select it in the project window, and apply or revert
 * overrides one by one or all at once.
 */
export function PrefabBar({
  instance,
  scene,
}: {
  instance: { rootId: string; prefabId: string; root: SceneObjectData };
  scene: SceneData | null;
}) {
  const t = useT();
  const project = useDocument((state) => state.project);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const asset = project?.assetOfType(instance.prefabId, 'prefab');
  const overrides = instance.root.prefab?.overrides ?? [];

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent): void => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);

  return (
    <div className="prefab-bar" data-testid="prefab-bar" ref={rootRef}>
      <Package size={14} className="prefab-icon" />
      <span className="prefab-name">
        {asset ? assetDisplayName(asset.path) : t('prefab.missing')}
      </span>
      <button
        type="button"
        className="small"
        data-testid="prefab-open"
        disabled={!asset}
        onClick={() => openPrefab(instance.prefabId)}
      >
        {t('prefab.open')}
      </button>
      <button
        type="button"
        className="small"
        data-testid="prefab-select"
        disabled={!asset}
        onClick={() => useEditor.getState().selectAsset(instance.prefabId)}
      >
        {t('prefab.select')}
      </button>
      <button
        type="button"
        className={`small${overrides.length > 0 ? ' has-overrides' : ''}`}
        data-testid="prefab-overrides"
        onClick={() => setOpen(!open)}
      >
        {t('prefab.overridesCount', { n: overrides.length })}
      </button>
      {open && (
        <div className="prefab-overrides" data-testid="prefab-overrides-list">
          {overrides.length === 0 && <div className="muted">{t('prefab.noOverrides')}</div>}
          {overrides.map((override) => (
            <div key={`${override.object}|${override.path}`} className="override-row">
              <span>{describe(override, scene, instance.rootId)}</span>
              <button
                type="button"
                className="small"
                onClick={() => applyInstanceOverrides(instance.rootId, (item) => item === override)}
              >
                {t('prefab.apply')}
              </button>
              <button
                type="button"
                className="small"
                onClick={() =>
                  revertInstanceOverrides(instance.rootId, (item) => item === override)
                }
              >
                {t('prefab.revert')}
              </button>
            </div>
          ))}
          <div className="override-actions">
            <button
              type="button"
              data-testid="prefab-revert-all"
              disabled={overrides.length === 0}
              onClick={() => {
                revertInstanceOverrides(instance.rootId);
                setOpen(false);
              }}
            >
              {t('prefab.revertAll')}
            </button>
            <button
              type="button"
              data-testid="prefab-apply-all"
              disabled={overrides.length === 0 || !asset}
              onClick={() => {
                applyInstanceOverrides(instance.rootId);
                setOpen(false);
              }}
            >
              {t('prefab.applyAll')}
            </button>
          </div>
          <button
            type="button"
            className="link-button"
            onClick={() => {
              unpackInstance(instance.rootId);
              setOpen(false);
            }}
          >
            {t('prefab.unpack')}
          </button>
        </div>
      )}
    </div>
  );
}

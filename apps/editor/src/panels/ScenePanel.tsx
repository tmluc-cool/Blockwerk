import type { IDockviewPanelProps } from 'dockview-react';
import { assetDisplayName } from '@blockwerk/project';
import { ArrowLeft, Grid3x3, Package, Sparkles } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { DragEvent } from 'react';
import { AxisGizmo } from '../scene/AxisGizmo';
import { activateSceneView, registerSceneView, unregisterSceneView } from '../scene/sceneViews';
import { SceneViewport } from '../scene/SceneViewport';
import type { SceneCameraSnapshot, ShadingMode } from '../scene/SceneViewport';
import { createLibraryObject, createModelObject, placeBrushObjects } from '../document/actions';
import { useBrush } from '../library/brush';
import type { BrushSource, GroundPoint } from '../library/brush';
import { currentEditWorld } from '../scene/worlds';
import { usePlay } from '../state/play';
import { instantiatePrefabAsset } from '../document/prefabActions';
import { editTransforms } from '../document/edits';
import { libraryRef, useAssetLibrary } from '../library/assetLibrary';
import { draggedLibraryEntry, endLibraryDrag } from '../library/drag';
import { draggedAssetId, endAssetDrag } from '../library/projectDrag';
import { closePrefab, useDocument } from '../state/document';
import { sealHistory } from '../state/document';
import { useEditor } from '../state/editor';
import { useSettings, useT } from '../state/settings';

/** Ground positions of objects the brush would place again (so strokes keep their spacing). */
function brushedPositions(source: BrushSource): GroundPoint[] {
  const world = currentEditWorld();
  const scene = useDocument.getState().scene;
  if (!world || !scene) return [];
  const points: GroundPoint[] = [];
  for (const [id, object] of Object.entries(scene.objects)) {
    const matches =
      source.kind === 'prefab'
        ? object.prefab?.asset === source.id && object.prefab.overrides !== undefined
        : object.components.some(
            (component) =>
              component.type === 'meshRenderer' &&
              component.values['model'] === `library:${source.id}`,
          );
    const position = matches ? world.getObject(id)?.worldPosition() : undefined;
    if (position) points.push([position.x, position.z]);
  }
  return points;
}

/** Name of what the brush paints, if it is active. */
function useBrushName(): string | null {
  const source = useBrush((state) => state.source);
  const locale = useSettings((state) => state.locale);
  const project = useDocument((state) => state.project);
  const entries = useAssetLibrary((state) => state.byId);
  if (!source) return null;
  if (source.kind === 'library') return entries.get(source.id)?.name[locale] ?? source.id;
  const asset = project?.asset(source.id);
  return asset ? assetDisplayName(asset.path) : source.id;
}

/** Whether WebGL 2 can be used in this document. */
function webgl2Available(): boolean {
  try {
    return document.createElement('canvas').getContext('webgl2') !== null;
  } catch {
    return false;
  }
}

/** Scene window: the editable 3D view with Unity navigation, grid and scene gizmo. */
export function ScenePanel({ api }: IDockviewPanelProps) {
  const t = useT();
  const hostRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<SceneViewport | null>(null);
  const [snapshot, setSnapshot] = useState<SceneCameraSnapshot | null>(null);
  const [supported] = useState(webgl2Available);
  const [shading, setShading] = useState<ShadingMode>('shaded');
  const [grid, setGrid] = useState(true);
  const [sky, setSky] = useState(true);
  const tool = useEditor((state) => state.tool);
  const brushName = useBrushName();
  const stageName = useDocument((state) => {
    const id = state.prefabStage?.prefabId;
    const asset = id ? state.project?.asset(id) : undefined;
    return asset ? assetDisplayName(asset.path) : null;
  });
  const pivotMode = useEditor((state) => state.pivotMode);
  const space = useEditor((state) => state.space);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !supported) return;
    const viewport = new SceneViewport(host, {
      cameraChanged: setSnapshot,
      pick: (id, additive) => {
        const editor = useEditor.getState();
        if (additive) editor.select(id, 'toggle');
        else editor.select(id);
      },
      tool: () => useEditor.getState().tool,
      pivotMode: () => useEditor.getState().pivotMode,
      space: () => useEditor.getState().space,
      flyingChanged: (flying) => useEditor.getState().setFlying(flying),
      transform: editTransforms,
      transformEnd: sealHistory,
      brush: () => {
        const brush = useBrush.getState();
        const source = brush.source;
        if (!source || usePlay.getState().status !== 'stopped') return null;
        return {
          radius: brush.radius,
          spacing: brush.spacing,
          existing: () => brushedPositions(source),
        };
      },
      brushPlace: (points, stroke) => {
        const source = useBrush.getState().source;
        if (source) placeBrushObjects(source, points, stroke);
      },
    });
    viewportRef.current = viewport;
    registerSceneView(viewport);
    viewport.setSelection(useEditor.getState().selection);
    // Synchronously, so a click right after selecting in the hierarchy sees the new gizmo.
    const unsubscribeSelection = useEditor.subscribe((state, previous) => {
      if (state.selection !== previous.selection) viewport.setSelection(state.selection);
    });
    const unsubscribeBrush = useBrush.subscribe((state, previous) => {
      if (state.source !== previous.source || state.radius !== previous.radius) {
        viewport.refreshBrush();
      }
    });
    const activate = (): void => activateSceneView(viewport);
    host.addEventListener('pointerdown', activate);
    const resize = (): void => viewport.resize(host.clientWidth, host.clientHeight);
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    const dimensions = api.onDidDimensionsChange(resize);
    const visibility = api.onDidVisibilityChange((event) => {
      if (event.isVisible) {
        resize();
        viewport.requestRender();
      }
    });
    return () => {
      unsubscribeBrush();
      unsubscribeSelection();
      host.removeEventListener('pointerdown', activate);
      observer.disconnect();
      dimensions.dispose();
      visibility.dispose();
      unregisterSceneView(viewport);
      viewport.dispose();
      viewportRef.current = null;
    };
  }, [api, supported]);

  useEffect(() => {
    viewportRef.current?.refreshTool();
  }, [tool, pivotMode, space]);

  /** Canvas position of a drag event in CSS pixels. */
  const canvasPoint = (event: DragEvent): { x: number; y: number } => {
    const rect = viewportRef.current?.canvas.getBoundingClientRect();
    return { x: event.clientX - (rect?.left ?? 0), y: event.clientY - (rect?.top ?? 0) };
  };

  // Dragging a model from the asset library shows it standing on the surface under the mouse.
  /** Model shown while dragging: a library entry or a project model. Prefabs need no preview. */
  const draggedPlaceable = (): { model: string | null } | null => {
    const entry = draggedLibraryEntry();
    if (entry) return { model: libraryRef(entry) };
    const assetId = draggedAssetId();
    const asset = assetId ? useDocument.getState().project?.asset(assetId) : undefined;
    if (asset?.type === 'model') return { model: asset.id };
    if (asset?.type === 'prefab') return { model: null };
    return null;
  };
  const onDragOver = (event: DragEvent): void => {
    const placeable = draggedPlaceable();
    const viewport = viewportRef.current;
    if (!placeable || !viewport) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    const { x, y } = canvasPoint(event);
    viewport.showDropPreview(placeable.model, viewport.surfacePoint(x, y));
  };
  const onDragLeave = (event: DragEvent): void => {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
    viewportRef.current?.showDropPreview(null);
  };
  const onDrop = (event: DragEvent): void => {
    const entry = draggedLibraryEntry();
    const assetId = draggedAssetId();
    const viewport = viewportRef.current;
    if ((!entry && !assetId) || !viewport) return;
    event.preventDefault();
    const { x, y } = canvasPoint(event);
    const point = viewport.surfacePoint(x, y);
    const position: [number, number, number] = [point.x, point.y, point.z];
    viewport.showDropPreview(null);
    endLibraryDrag();
    endAssetDrag();
    activateSceneView(viewport);
    if (entry) {
      createLibraryObject(entry, position);
      return;
    }
    const asset = assetId ? useDocument.getState().project?.asset(assetId) : undefined;
    if (asset?.type === 'prefab') instantiatePrefabAsset(asset.id, position);
    else if (asset?.type === 'model') void createModelObject(asset.id, position);
  };

  if (!supported) {
    return (
      <div className="panel scene">
        <div className="empty-hint">{t('scene.webglMissing')}</div>
      </div>
    );
  }

  return (
    <div className="panel scene" data-testid="scene-view">
      {brushName && (
        <div className="brush-hint" data-testid="brush-hint">
          {t('brush.hint', { name: brushName })}
        </div>
      )}
      {stageName && (
        <div className="prefab-stage-bar" data-testid="prefab-stage">
          <Package size={14} />
          <span>{t('prefab.mode', { name: stageName })}</span>
          <button type="button" className="small" data-testid="prefab-back" onClick={closePrefab}>
            <ArrowLeft size={13} /> {t('prefab.back')}
          </button>
        </div>
      )}
      <div className="panel-toolbar">
        <label className="toolbar-field">
          <span className="muted">{t('scene.shading')}</span>
          <select
            value={shading}
            data-testid="shading-mode"
            onChange={(event) => {
              const mode = event.target.value as ShadingMode;
              setShading(mode);
              viewportRef.current?.setShading(mode);
            }}
          >
            <option value="shaded">{t('scene.shaded')}</option>
            <option value="wireframe">{t('scene.wireframe')}</option>
          </select>
        </label>
        <button
          type="button"
          className={grid ? 'toggled icon-button' : 'icon-button'}
          aria-pressed={grid}
          title={t('scene.grid')}
          onClick={() => {
            setGrid(!grid);
            viewportRef.current?.setGridVisible(!grid);
          }}
        >
          <Grid3x3 size={15} />
        </button>
        <button
          type="button"
          className={sky ? 'toggled icon-button' : 'icon-button'}
          aria-pressed={sky}
          title={t('scene.skyFog')}
          onClick={() => {
            setSky(!sky);
            viewportRef.current?.setSkyAndFogVisible(!sky);
          }}
        >
          <Sparkles size={15} />
        </button>
        <span className="toolbar-spacer" />
        {snapshot && (
          <span className="muted" data-testid="camera-speed">
            {t('scene.cameraSpeed')} {snapshot.speed.toFixed(2)}
          </span>
        )}
      </div>
      <div
        className="viewport-host"
        ref={hostRef}
        data-testid="scene-drop"
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        <AxisGizmo
          snapshot={snapshot}
          onView={(view) => viewportRef.current?.setAxisView(view)}
          onToggleProjection={() => viewportRef.current?.toggleProjection()}
        />
      </div>
    </div>
  );
}

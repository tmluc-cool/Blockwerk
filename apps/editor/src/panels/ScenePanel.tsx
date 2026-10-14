import type { IDockviewPanelProps } from 'dockview-react';
import { Grid3x3, Sparkles } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { DragEvent } from 'react';
import { AxisGizmo } from '../scene/AxisGizmo';
import { activateSceneView, registerSceneView, unregisterSceneView } from '../scene/sceneViews';
import { SceneViewport } from '../scene/SceneViewport';
import type { SceneCameraSnapshot, ShadingMode } from '../scene/SceneViewport';
import { createLibraryObject } from '../document/actions';
import { editTransforms } from '../document/edits';
import { libraryRef } from '../library/assetLibrary';
import { draggedLibraryEntry, endLibraryDrag } from '../library/drag';
import { sealHistory } from '../state/document';
import { useEditor } from '../state/editor';
import { useT } from '../state/settings';

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
    });
    viewportRef.current = viewport;
    registerSceneView(viewport);
    viewport.setSelection(useEditor.getState().selection);
    // Synchronously, so a click right after selecting in the hierarchy sees the new gizmo.
    const unsubscribeSelection = useEditor.subscribe((state, previous) => {
      if (state.selection !== previous.selection) viewport.setSelection(state.selection);
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
  const onDragOver = (event: DragEvent): void => {
    const entry = draggedLibraryEntry();
    const viewport = viewportRef.current;
    if (!entry || !viewport) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    const { x, y } = canvasPoint(event);
    viewport.showDropPreview(libraryRef(entry), viewport.surfacePoint(x, y));
  };
  const onDragLeave = (event: DragEvent): void => {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
    viewportRef.current?.showDropPreview(null);
  };
  const onDrop = (event: DragEvent): void => {
    const entry = draggedLibraryEntry();
    const viewport = viewportRef.current;
    if (!entry || !viewport) return;
    event.preventDefault();
    const { x, y } = canvasPoint(event);
    const point = viewport.surfacePoint(x, y);
    viewport.showDropPreview(null);
    endLibraryDrag();
    activateSceneView(viewport);
    createLibraryObject(entry, [point.x, point.y, point.z]);
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

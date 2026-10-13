import type { IDockviewPanelProps } from 'dockview-react';
import { Grid3x3, Sparkles } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { AxisGizmo } from '../scene/AxisGizmo';
import { activateSceneView, registerSceneView, unregisterSceneView } from '../scene/sceneViews';
import { SceneViewport } from '../scene/SceneViewport';
import type { SceneCameraSnapshot, ShadingMode } from '../scene/SceneViewport';
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
  const selectedId = useEditor((state) => state.selectedObjectId);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !supported) return;
    const viewport = new SceneViewport(host, {
      cameraChanged: setSnapshot,
      select: (id) => useEditor.getState().select(id),
      tool: () => useEditor.getState().tool,
      flyingChanged: (flying) => useEditor.getState().setFlying(flying),
    });
    viewportRef.current = viewport;
    registerSceneView(viewport);
    viewport.setSelection(useEditor.getState().selectedObjectId);
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
    viewportRef.current?.setSelection(selectedId);
  }, [selectedId]);

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
      <div className="viewport-host" ref={hostRef}>
        <AxisGizmo
          snapshot={snapshot}
          onView={(view) => viewportRef.current?.setAxisView(view)}
          onToggleProjection={() => viewportRef.current?.toggleProjection()}
        />
      </div>
    </div>
  );
}

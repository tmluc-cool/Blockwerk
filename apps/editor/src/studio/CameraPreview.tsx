import type { SceneData } from '@blockwerk/project';
import { useEffect, useRef } from 'react';
import { useT } from '../state/settings';
import type { StageViewport } from './StudioStage';
import { setValue } from './studio';
import { SliderRow, StudioGroup } from './widgets';

/** The first third-person camera of the scene: the one the preview shows. */
export function findThirdPersonCamera(
  scene: SceneData,
): { id: string; distance: number; height: number; shoulder: number } | null {
  for (const [id, object] of Object.entries(scene.objects)) {
    const component = object.components.find((candidate) => candidate.type === 'thirdPersonCamera');
    if (!component) continue;
    const values = component.values;
    return {
      id,
      distance: Number(values['distance'] ?? 4),
      height: Number(values['height'] ?? 1.5),
      shoulder: Number(values['shoulder'] ?? 0.4),
    };
  }
  return null;
}

/**
 * A small window that shows how the game camera sees the figure. Dragging in the picture moves
 * the camera (left/right: shoulder offset, up/down: height); the mouse wheel changes the distance.
 */
export function CameraPreview({ scene, stage }: { scene: SceneData; stage: StageViewport | null }) {
  const t = useT();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const camera = findThirdPersonCamera(scene);
  const settings = camera ?? { id: '', distance: 4, height: 1.5, shoulder: 0.4 };
  const key = `${settings.distance}|${settings.height}|${settings.shoulder}`;

  useEffect(() => {
    stage?.setCameraPreview(canvasRef.current, {
      distance: settings.distance,
      height: settings.height,
      shoulder: settings.shoulder,
      fov: 55,
    });
    return () =>
      stage?.setCameraPreview(null, { distance: 4, height: 1.5, shoulder: 0.4, fov: 55 });
    // The settings are read through `key`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, key]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !camera) return;
    let dragging = false;
    const down = (event: PointerEvent): void => {
      dragging = true;
      canvas.setPointerCapture(event.pointerId);
    };
    const move = (event: PointerEvent): void => {
      if (!dragging) return;
      setValue(
        camera.id,
        'thirdPersonCamera',
        'shoulder',
        Math.round((camera.shoulder - event.movementX * 0.01) * 100) / 100,
      );
      setValue(
        camera.id,
        'thirdPersonCamera',
        'height',
        Math.round((camera.height + event.movementY * 0.01) * 100) / 100,
      );
    };
    const up = (): void => {
      dragging = false;
    };
    const wheel = (event: WheelEvent): void => {
      event.preventDefault();
      setValue(
        camera.id,
        'thirdPersonCamera',
        'distance',
        Math.max(0.5, Math.round((camera.distance + event.deltaY * 0.005) * 10) / 10),
      );
    };
    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('wheel', wheel, { passive: false });
    return () => {
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up);
      canvas.removeEventListener('wheel', wheel);
    };
  }, [camera]);

  return (
    <StudioGroup title={t('studio.camera')}>
      <canvas
        ref={canvasRef}
        className="studio-camera-canvas"
        data-testid="studio-camera-preview"
        title={t('studio.camera.hint')}
      />
      {camera ? (
        <>
          <SliderRow
            label={t('studio.camera.distance')}
            value={camera.distance}
            min={0.5}
            max={12}
            step={0.1}
            unit="m"
            testId="camera-distance"
            onChange={(value) => setValue(camera.id, 'thirdPersonCamera', 'distance', value)}
          />
          <SliderRow
            label={t('studio.camera.height')}
            value={camera.height}
            min={0}
            max={4}
            step={0.05}
            unit="m"
            testId="camera-height"
            onChange={(value) => setValue(camera.id, 'thirdPersonCamera', 'height', value)}
          />
          <SliderRow
            label={t('studio.camera.shoulder')}
            value={camera.shoulder}
            min={-2}
            max={2}
            step={0.05}
            unit="m"
            testId="camera-shoulder"
            onChange={(value) => setValue(camera.id, 'thirdPersonCamera', 'shoulder', value)}
          />
        </>
      ) : (
        <p className="muted">{t('studio.camera.none')}</p>
      )}
    </StudioGroup>
  );
}

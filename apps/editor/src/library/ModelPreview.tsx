import { ModelCache } from '@blockwerk/runtime';
import { useEffect, useRef } from 'react';
import {
  Box3,
  Color,
  DirectionalLight,
  HemisphereLight,
  PerspectiveCamera,
  Scene,
  Sphere,
  Vector3,
  WebGLRenderer,
} from 'three';
import type { Object3D } from 'three';
import { editorModels } from './models';

const BACKGROUND = new Color(0x2a2d33);

/**
 * A rotatable 3D preview of a model (SPEC 6.1): drag to turn, mouse wheel to zoom. Draws only
 * when something changed.
 */
export function ModelPreview({ modelRef, testId }: { modelRef: string; testId?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let renderer: WebGLRenderer;
    try {
      renderer = new WebGLRenderer({ canvas, antialias: true });
    } catch {
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    const scene = new Scene();
    scene.background = BACKGROUND;
    scene.add(new HemisphereLight(0xffffff, 0x4a4036, 1.6));
    const sun = new DirectionalLight(0xffffff, 2.2);
    sun.position.set(3, 5, 4);
    scene.add(sun);
    const camera = new PerspectiveCamera(35, 1, 0.01, 1000);
    const center = new Vector3();
    let radius = 1;
    let yaw = 0.7;
    let pitch = 0.45;
    let zoom = 1;
    let model: Object3D | null = null;
    let frame = 0;
    let disposed = false;

    const draw = (): void => {
      frame = 0;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (width === 0 || height === 0) return;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      const distance = (radius / Math.sin((camera.fov * Math.PI) / 360)) * zoom;
      camera.position.set(
        center.x + distance * Math.cos(pitch) * Math.sin(yaw),
        center.y + distance * Math.sin(pitch),
        center.z + distance * Math.cos(pitch) * Math.cos(yaw),
      );
      camera.near = distance / 100;
      camera.far = distance * 10;
      camera.updateProjectionMatrix();
      camera.lookAt(center);
      renderer.render(scene, camera);
    };
    const request = (): void => {
      if (!frame && !disposed) frame = requestAnimationFrame(draw);
    };

    void editorModels.load(modelRef).then((template) => {
      if (disposed || !template) return;
      model = ModelCache.instantiate(template);
      scene.add(model);
      const sphere = new Box3().setFromObject(model).getBoundingSphere(new Sphere());
      center.copy(sphere.center);
      radius = Math.max(sphere.radius, 0.05);
      request();
    });

    let dragging = false;
    const down = (event: PointerEvent): void => {
      dragging = true;
      canvas.setPointerCapture(event.pointerId);
    };
    const move = (event: PointerEvent): void => {
      if (!dragging) return;
      yaw -= event.movementX * 0.01;
      pitch = Math.min(1.4, Math.max(-1.4, pitch + event.movementY * 0.01));
      request();
    };
    const up = (): void => {
      dragging = false;
    };
    const wheel = (event: WheelEvent): void => {
      event.preventDefault();
      zoom = Math.min(4, Math.max(0.4, zoom * Math.exp(event.deltaY * 0.001)));
      request();
    };
    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('wheel', wheel, { passive: false });
    const observer = new ResizeObserver(request);
    observer.observe(canvas);
    request();
    return () => {
      disposed = true;
      if (frame) cancelAnimationFrame(frame);
      observer.disconnect();
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up);
      canvas.removeEventListener('wheel', wheel);
      renderer.dispose();
    };
  }, [modelRef]);

  return <canvas ref={canvasRef} className="model-preview" data-testid={testId} />;
}

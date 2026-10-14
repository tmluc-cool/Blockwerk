import { Color, DoubleSide, Mesh, PlaneGeometry, ShaderMaterial, Vector3 } from 'three';
import type { Camera } from 'three';

const vertexShader = /* glsl */ `
  varying vec3 vWorld;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uCameraPosition;
  uniform float uFadeDistance;
  varying vec3 vWorld;

  float gridLine(vec2 position, float size) {
    vec2 coord = position / size;
    vec2 grid = abs(fract(coord - 0.5) - 0.5) / fwidth(coord);
    return 1.0 - min(min(grid.x, grid.y), 1.0);
  }

  void main() {
    float minor = gridLine(vWorld.xz, 1.0);
    float major = gridLine(vWorld.xz, 10.0);
    float distanceToCamera = distance(uCameraPosition.xz, vWorld.xz);
    float fade = 1.0 - smoothstep(uFadeDistance * 0.35, uFadeDistance, distanceToCamera);
    float alpha = max(minor * 0.22, major * 0.42) * fade;
    if (alpha < 0.004) discard;
    gl_FragColor = vec4(uColor, alpha);
  }
`;

/** Infinite-looking editor grid on the ground plane (1 m and 10 m lines), fading with distance. */
export class EditorGrid extends Mesh<PlaneGeometry, ShaderMaterial> {
  private readonly cameraPosition = new Vector3();

  constructor() {
    super(
      new PlaneGeometry(1, 1),
      new ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms: {
          uColor: { value: new Color(0.92, 0.94, 0.97) },
          uCameraPosition: { value: new Vector3() },
          uFadeDistance: { value: 60 },
        },
        transparent: true,
        depthWrite: false,
        side: DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      }),
    );
    this.name = 'EditorGrid';
    this.rotation.x = -Math.PI / 2;
    this.renderOrder = 1;
    this.frustumCulled = false;
  }

  /** Re-centers the grid under the camera and adapts the fade distance to the camera height. */
  update(camera: Camera, pivotDistance: number): void {
    camera.getWorldPosition(this.cameraPosition);
    const fadeDistance = Math.max(40, Math.abs(this.cameraPosition.y) * 25, pivotDistance * 4);
    const size = fadeDistance * 2.2;
    this.scale.set(size, size, 1);
    this.position.set(
      Math.round(this.cameraPosition.x / 10) * 10,
      0,
      Math.round(this.cameraPosition.z / 10) * 10,
    );
    const uniforms = this.material.uniforms;
    (uniforms['uCameraPosition']?.value as Vector3).copy(this.cameraPosition);
    if (uniforms['uFadeDistance']) uniforms['uFadeDistance'].value = fadeDistance;
  }

  /** Frees the grid's geometry and material. */
  override dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
    super.dispose();
  }
}

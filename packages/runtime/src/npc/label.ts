import { CanvasTexture, Sprite, SpriteMaterial } from 'three';

/** A small text drawn above an NPC (its state in play mode). */
export interface StateLabel {
  readonly sprite: Sprite;
  setText(text: string): void;
  dispose(): void;
}

/** Creates the label, or `null` where no canvas exists (unit tests in Node). */
export function createStateLabel(): StateLabel | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const context = canvas.getContext('2d');
  if (!context) return null;
  const texture = new CanvasTexture(canvas);
  const material = new SpriteMaterial({ map: texture, transparent: true, depthTest: false });
  const sprite = new Sprite(material);
  sprite.scale.set(1.6, 0.4, 1);
  sprite.renderOrder = 20;
  sprite.userData['stateLabel'] = true;
  let shown = '';
  return {
    sprite,
    setText(text) {
      if (text === shown) return;
      shown = text;
      context.clearRect(0, 0, canvas.width, canvas.height);
      if (text) {
        context.fillStyle = 'rgba(16, 18, 22, 0.75)';
        context.beginPath();
        context.roundRect(8, 8, canvas.width - 16, canvas.height - 16, 14);
        context.fill();
        context.fillStyle = '#f2f4f8';
        context.font = 'bold 30px system-ui, sans-serif';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(text, canvas.width / 2, canvas.height / 2 + 2);
      }
      texture.needsUpdate = true;
    },
    dispose() {
      sprite.removeFromParent();
      texture.dispose();
      material.dispose();
    },
  };
}

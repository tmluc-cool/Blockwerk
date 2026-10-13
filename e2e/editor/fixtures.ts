import { expect, test as base } from '@playwright/test';
import type { Page } from '@playwright/test';

/** Camera snapshot as returned by `window.__blockwerk.sceneCamera()`. */
export interface CameraSnapshot {
  position: [number, number, number];
  pivot: [number, number, number];
  distance: number;
  yaw: number;
  pitch: number;
  orthographic: boolean;
  axisView: string | null;
  speed: number;
  animating: boolean;
}

/**
 * Editor test fixture: opens the editor, waits until the scene view rendered, and fails the
 * test if the page logs errors or tries to reach the network (only localhost is allowed).
 */
export const test = base.extend<{ editor: Page }>({
  editor: async ({ page }, use) => {
    const problems: string[] = [];
    page.on('pageerror', (error) => problems.push(`page error: ${error.message}`));
    page.on('console', (message) => {
      if (message.type() === 'error') problems.push(`console error: ${message.text()}`);
    });
    page.on('request', (request) => {
      const url = new URL(request.url());
      if (
        url.protocol.startsWith('http') &&
        url.hostname !== 'localhost' &&
        url.hostname !== '127.0.0.1'
      ) {
        problems.push(`network request: ${request.url()}`);
      }
    });
    await page.goto('/');
    await expect(page.getByTestId('scene-canvas')).toBeVisible();
    await expect.poll(() => sceneCamera(page)).not.toBeNull();
    await use(page);
    expect(problems).toEqual([]);
  },
});

export { expect };

/** Reads the scene camera state. */
export async function sceneCamera(page: Page): Promise<CameraSnapshot | null> {
  return page.evaluate(() => (window.__blockwerk?.sceneCamera() ?? null) as CameraSnapshot | null);
}

/** Reads the scene camera state, failing if there is no scene view. */
export async function camera(page: Page): Promise<CameraSnapshot> {
  const snapshot = await sceneCamera(page);
  if (!snapshot) throw new Error('no scene view');
  return snapshot;
}

/** Center of the scene canvas in page coordinates. */
export async function sceneCenter(page: Page): Promise<{ x: number; y: number }> {
  const box = await page.getByTestId('scene-canvas').boundingBox();
  if (!box) throw new Error('scene canvas not visible');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** Distance between two points. */
export function distance(a: readonly number[], b: readonly number[]): number {
  return Math.hypot(...a.map((value, index) => value - (b[index] ?? 0)));
}

/** Tab header of a docked window. */
export function tab(page: Page, title: string) {
  return page.locator('.dv-tab', { hasText: title });
}

/** Waits until a running camera transition (focus, axis view) has finished. */
export async function settle(page: Page): Promise<CameraSnapshot> {
  // Give the transition a frame to start, then wait for it to end.
  await page.waitForTimeout(150);
  await expect.poll(async () => (await camera(page)).animating, { timeout: 15_000 }).toBe(false);
  return camera(page);
}

/** Unit vector the scene camera looks along. */
export function forwardOf(snapshot: CameraSnapshot): [number, number, number] {
  const { yaw, pitch } = snapshot;
  return [-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)];
}

import {
  createPrimitive,
  objectId,
  camera,
  distance,
  expect,
  forwardOf,
  sceneCenter,
  settle,
  test,
} from './fixtures';

test.describe('scene view camera (Unity navigation)', () => {
  test('right mouse button + W flies forward, Q/E move down/up', async ({ editor: page }) => {
    const start = await camera(page);
    const center = await sceneCenter(page);
    await page.mouse.move(center.x, center.y);
    await page.mouse.down({ button: 'right' });

    // Hold W until the camera has moved. Software rendering in CI can pause frames for a
    // moment, so the test waits for the movement instead of holding the key for a fixed time.
    await page.keyboard.down('w');
    await expect
      .poll(async () => distance((await camera(page)).position, start.position), {
        timeout: 30_000,
      })
      .toBeGreaterThan(0.3);
    await page.keyboard.up('w');
    const afterForward = await camera(page);

    await page.keyboard.down('e');
    await expect
      .poll(async () => (await camera(page)).position[1] - afterForward.position[1], {
        timeout: 30_000,
      })
      .toBeGreaterThan(0.2);
    await page.keyboard.up('e');
    const afterUp = await camera(page);
    await page.mouse.up({ button: 'right' });

    // Moved along the viewing direction; the pivot moved with the camera.
    const moved = afterForward.position.map((value, index) => value - (start.position[index] ?? 0));
    const length = Math.hypot(...moved);
    const forward = forwardOf(start);
    const alignment =
      moved.reduce((sum, value, index) => sum + value * (forward[index] ?? 0), 0) / length;
    expect(alignment).toBeGreaterThan(0.99);
    expect(afterForward.distance).toBeCloseTo(start.distance, 5);
    expect(afterForward.yaw).toBeCloseTo(start.yaw, 5);
    // E moves straight up in world space.
    expect(afterUp.position[0]).toBeCloseTo(afterForward.position[0], 5);
    expect(afterUp.position[2]).toBeCloseTo(afterForward.position[2], 5);
    // While flying, W/E must not switch tools.
    expect(await page.evaluate(() => window.__blockwerk?.tool())).toBe('move');
  });

  test('right mouse drag looks around without moving the camera', async ({ editor: page }) => {
    const start = await camera(page);
    const center = await sceneCenter(page);
    await page.mouse.move(center.x, center.y);
    await page.mouse.down({ button: 'right' });
    await page.mouse.move(center.x + 120, center.y + 30, { steps: 6 });
    await page.mouse.up({ button: 'right' });
    const after = await camera(page);
    expect(distance(after.position, start.position)).toBeLessThan(1e-6);
    expect(after.yaw).not.toBeCloseTo(start.yaw, 2);
  });

  test('Alt + left mouse button orbits around the pivot', async ({ editor: page }) => {
    const start = await camera(page);
    const center = await sceneCenter(page);
    await page.keyboard.down('Alt');
    await page.mouse.move(center.x, center.y);
    await page.mouse.down();
    await page.mouse.move(center.x + 150, center.y - 40, { steps: 6 });
    await page.mouse.up();
    await page.keyboard.up('Alt');
    const after = await camera(page);
    expect(distance(after.pivot, start.pivot)).toBeLessThan(1e-6);
    expect(after.distance).toBeCloseTo(start.distance, 5);
    expect(after.yaw).not.toBeCloseTo(start.yaw, 2);
    expect(distance(after.position, start.position)).toBeGreaterThan(1);
  });

  test('middle mouse button pans, mouse wheel zooms', async ({ editor: page }) => {
    const start = await camera(page);
    const center = await sceneCenter(page);
    await page.mouse.move(center.x, center.y);
    await page.mouse.down({ button: 'middle' });
    await page.mouse.move(center.x - 100, center.y + 60, { steps: 5 });
    await page.mouse.up({ button: 'middle' });
    const panned = await camera(page);
    expect(distance(panned.pivot, start.pivot)).toBeGreaterThan(0.3);
    expect(panned.yaw).toBeCloseTo(start.yaw, 6);

    await page.mouse.wheel(0, -400);
    await expect
      .poll(async () => (await camera(page)).distance)
      .toBeLessThan(panned.distance * 0.9);
  });

  test('hand tool (Q) pans with the left mouse button', async ({ editor: page }) => {
    await page.keyboard.press('q');
    expect(await page.evaluate(() => window.__blockwerk?.tool())).toBe('hand');
    const start = await camera(page);
    const center = await sceneCenter(page);
    await page.mouse.move(center.x, center.y);
    await page.mouse.down();
    await page.mouse.move(center.x + 80, center.y, { steps: 4 });
    await page.mouse.up();
    expect(distance((await camera(page)).pivot, start.pivot)).toBeGreaterThan(0.2);
  });

  test('F frames the selection, double-click in the hierarchy too', async ({ editor: page }) => {
    // A new cube appears at the scene view pivot (0, 0.5, 0).
    await createPrimitive(page, 'cube');
    // Move away first.
    const center = await sceneCenter(page);
    await page.mouse.move(center.x, center.y);
    await page.mouse.down({ button: 'middle' });
    await page.mouse.move(center.x - 300, center.y + 200, { steps: 5 });
    await page.mouse.up({ button: 'middle' });
    expect(distance((await camera(page)).pivot, [0, 0.5, 0])).toBeGreaterThan(1);

    await page.getByTestId('hierarchy').getByText('Würfel').click();
    await page.keyboard.press('f');
    const framed = await settle(page);
    expect(distance(framed.pivot, [0, 0.5, 0])).toBeLessThan(0.01);
    expect(framed.distance).toBeLessThan(5);

    await page.getByTestId('hierarchy').getByText('Hauptkamera').dblclick();
    const atCamera = await settle(page);
    expect(distance(atCamera.pivot, [0, 3, -8])).toBeLessThan(0.01);
    expect(await page.evaluate(() => window.__blockwerk?.selection())).toBe(
      await objectId(page, 'Hauptkamera'),
    );
  });

  test('clicking an object in the scene selects it, Ctrl+click adds to the selection', async ({
    editor: page,
  }) => {
    await createPrimitive(page, 'cube');
    const cube = await objectId(page, 'Würfel');
    await page.keyboard.press('f');
    await settle(page);
    await page.getByTestId('hierarchy').getByText('Boden').click();
    const center = await sceneCenter(page);
    await page.mouse.click(center.x, center.y);
    await expect.poll(() => page.evaluate(() => window.__blockwerk?.selection())).toBe(cube);
    await expect(page.getByTestId('inspector-name')).toHaveValue('Würfel');
    // Clicking empty sky clears the selection.
    const box = await page.getByTestId('scene-canvas').boundingBox();
    if (!box) throw new Error('no canvas');
    await page.mouse.click(box.x + 20, box.y + 20);
    await expect.poll(() => page.evaluate(() => window.__blockwerk?.selectionIds().length)).toBe(0);
  });

  test('axis gizmo switches to axis views and between perspective and orthographic', async ({
    editor: page,
  }) => {
    await page.locator('.axis-gizmo-handle[data-view="top"]').click();
    const top = await settle(page);
    expect(top.axisView).toBe('top');
    expect(top.orthographic).toBe(true);
    await expect(page.getByTestId('projection-toggle')).toHaveText('Oben · Iso');

    await page.getByTestId('projection-toggle').click();
    expect((await camera(page)).orthographic).toBe(false);

    await page.locator('.axis-gizmo-handle[data-view="right"]').click();
    const right = await settle(page);
    expect(right.axisView).toBe('right');
    expect(right.position[0]).toBeGreaterThan(right.pivot[0]);
  });
});

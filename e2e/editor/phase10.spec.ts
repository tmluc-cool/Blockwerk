import type { Page, Route } from '@playwright/test';
import { createPrimitive, expect, objectId, scaled, test } from './fixtures';

/**
 * Acceptance of phase 10 in the editor: the AI assistant (SPEC 9.4). The real API is never
 * called here: the browser's requests to api.anthropic.com are answered by the test, the way a
 * model would answer.
 */

const API = 'https://api.anthropic.com/v1/messages';
const KEY = 'sk-ant-test-key-0000';

interface ApiRequest {
  headers: Record<string, string>;
  body: {
    model: string;
    tool_choice?: { type: string; name: string };
    messages: { role: string; content: unknown }[];
  };
}

type Answer = { tool: string; input: unknown } | { status: number; message: string };

/** Opens the editor with a stored key and answers the API with what `answer` returns. */
async function openWithKey(
  page: Page,
  answer: (request: ApiRequest, index: number) => Answer,
): Promise<{ requests: ApiRequest[]; problems: string[] }> {
  const requests: ApiRequest[] = [];
  const problems: string[] = [];
  page.on('pageerror', (error) => problems.push(`page error: ${error.message}`));
  page.on('console', (message) => {
    // The 401 test makes the browser log the failed request on purpose.
    if (message.type() === 'error' && !message.text().includes('status of 401')) {
      problems.push(`console error: ${message.text()}`);
    }
  });
  page.on('request', (request) => {
    const url = new URL(request.url());
    const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    if (url.protocol.startsWith('http') && !local && request.url() !== API) {
      problems.push(`network request: ${request.url()}`);
    }
  });
  await page.addInitScript((key) => localStorage.setItem('blockwerk.ai.key', key), KEY);
  await page.route(API, async (route: Route) => {
    const request = route.request();
    const entry: ApiRequest = {
      headers: request.headers(),
      body: request.postDataJSON() as ApiRequest['body'],
    };
    const reply = answer(entry, requests.length);
    requests.push(entry);
    const cors = {
      'access-control-allow-origin': '*',
      'access-control-allow-headers': '*',
    };
    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: cors });
    } else if ('status' in reply) {
      await route.fulfill({
        status: reply.status,
        headers: cors,
        contentType: 'application/json',
        body: JSON.stringify({ type: 'error', error: { type: 'x', message: reply.message } }),
      });
    } else {
      await route.fulfill({
        status: 200,
        headers: cors,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'msg_test',
          type: 'message',
          role: 'assistant',
          content: [
            {
              type: 'tool_use',
              id: `toolu_${requests.length}`,
              name: reply.tool,
              input: reply.input,
            },
          ],
          stop_reason: 'tool_use',
        }),
      });
    }
  });
  await page.goto('/');
  await expect(page.getByTestId('scene-canvas')).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => window.__blockwerk?.project().status), { timeout: 20_000 })
    .toBe('ready');
  return { requests, problems };
}

async function openAssistant(page: Page): Promise<void> {
  await page.getByTestId('toolbar-ai').click();
  await expect(page.getByTestId('ai-panel')).toBeVisible();
}

async function ask(page: Page, task: string, prompt: string): Promise<void> {
  await page.getByTestId(`ai-task-${task}`).click();
  await page.getByTestId('ai-prompt').fill(prompt);
  await page.getByTestId('ai-send').click();
}

/** Number of components of this type over all objects of the open scene. */
function componentCount(page: Page, type: string): Promise<number> {
  return page.evaluate(
    (wanted) =>
      Object.values(window.__blockwerk?.scene()?.objects ?? {}).reduce(
        (sum, object) => sum + object.components.filter((c) => c.type === wanted).length,
        0,
      ),
    type,
  );
}

function sceneObjectCount(page: Page): Promise<number> {
  return page.evaluate(() => Object.keys(window.__blockwerk?.scene()?.objects ?? {}).length);
}

test.describe('phase 10: AI assistant', () => {
  test('without a key nothing of it is visible and nothing goes to the network', async ({
    editor: page,
  }) => {
    // The `editor` fixture fails the test on any request that leaves localhost.
    expect(await page.evaluate(() => window.__blockwerk?.aiState().hasKey)).toBe(false);
    await expect(page.getByTestId('toolbar-ai')).toHaveCount(0);
    await page.getByTestId('menu-window').click();
    await page.getByTestId('menu-open-window').hover();
    await expect(page.getByTestId('open-console')).toBeVisible();
    await expect(page.getByTestId('open-ai')).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('ai-panel')).toHaveCount(0);
    // The only trace is the key field under Edit > Preferences.
    await page.getByTestId('menu-edit').click();
    await page.getByTestId('menu-preferences').click();
    await expect(page.getByTestId('preferences-dialog')).toBeVisible();
    await expect(page.getByTestId('ai-key-input')).toBeVisible();
    await page.getByTestId('preferences-close').click();
    await expect(page.getByTestId('toolbar-ai')).toHaveCount(0);
  });

  test('a key entered in the preferences makes the assistant appear, removing it hides it', async ({
    editor: page,
  }) => {
    await page.getByTestId('menu-edit').click();
    await page.getByTestId('menu-preferences').click();
    await page.getByTestId('ai-key-input').fill(KEY);
    await page.getByTestId('ai-key-save').click();
    await expect(page.getByTestId('toolbar-ai')).toBeVisible();
    // The key is never shown again.
    await expect(page.getByTestId('preferences-dialog')).not.toContainText(KEY);
    await page.getByTestId('ai-key-remove').click();
    await expect(page.getByTestId('toolbar-ai')).toHaveCount(0);
    await page.getByTestId('preferences-close').click();
  });

  test('the guard script is a preview first, applies as one undo step and runs', async ({
    page,
  }) => {
    test.setTimeout(scaled(120_000));
    let gate = '';
    const { requests, problems } = await openWithKey(page, () => ({
      tool: 'propose_script',
      input: {
        name: 'Wache am Tor',
        summary: 'Die Wache bleibt am Tor und verfolgt den Spieler, sobald sie ihn sieht.',
        stacks: [
          [
            { block: 'events.whenGameStarts' },
            {
              block: 'control.forever',
              bodies: {
                body: [
                  {
                    block: 'control.waitUntil',
                    inputs: { condition: { block: 'npc.sees', fields: { target: 'tag:Player' } } },
                  },
                  {
                    block: 'npc.follow',
                    fields: { target: 'tag:Player' },
                    inputs: { distance: 1.5 },
                  },
                  {
                    block: 'control.waitUntil',
                    inputs: {
                      condition: {
                        block: 'operators.not',
                        inputs: {
                          value: { block: 'npc.sees', fields: { target: 'tag:Player' } },
                        },
                      },
                    },
                  },
                  { block: 'control.wait', inputs: { seconds: 2 } },
                  { block: 'npc.goTo', fields: { target: `object:${gate}` } },
                ],
              },
            },
          ],
        ],
      },
    }));
    await createPrimitive(page, 'cube');
    gate = await objectId(page, 'Würfel');
    await createPrimitive(page, 'sphere');
    const guard = await objectId(page, 'Kugel');
    expect(gate).not.toBe(guard);
    expect(await page.evaluate(() => window.__blockwerk?.selection())).toBe(guard);

    const before = await componentCount(page, 'blockScript');
    await openAssistant(page);
    await ask(
      page,
      'logic',
      'Wache soll das Tor bewachen und den Spieler verfolgen, wenn sie ihn sieht',
    );
    await expect(page.getByTestId('ai-preview')).toBeVisible();
    await expect(page.getByTestId('ai-preview-title')).toContainText('Wache am Tor');
    await expect(page.getByTestId('ai-outline')).toContainText('folge');
    // A preview changes nothing.
    expect(await componentCount(page, 'blockScript')).toBe(before);
    expect(requests).toHaveLength(1);
    expect(requests[0]?.headers['x-api-key']).toBe(KEY);
    expect(requests[0]?.headers['anthropic-version']).toBe('2023-06-01');
    expect(requests[0]?.body.tool_choice).toEqual({ type: 'tool', name: 'propose_script' });
    const model = await page.evaluate(() => window.__blockwerk?.aiState().model);
    expect(requests[0]?.body.model).toBe(model);

    // Apply: the script exists and sits on the selected guard; one undo takes it all back.
    await page.getByTestId('ai-apply').click();
    await expect(page.getByTestId('ai-applied')).toBeVisible();
    expect(await componentCount(page, 'blockScript')).toBe(before + 1);
    const withScript = await page.evaluate(
      (id) =>
        window.__blockwerk?.scene()?.objects[id]?.components.some((c) => c.type === 'blockScript'),
      guard,
    );
    expect(withScript).toBe(true);
    const files = await page.evaluate(() => Object.keys(window.__blockwerk?.files() ?? {}));
    expect(files.some((path) => path.includes('Wache am Tor'))).toBe(true);

    // It runs: the game starts, the script is compiled without errors and no error appears.
    await page.getByTestId('play').click();
    await expect.poll(() => page.evaluate(() => window.__blockwerk?.playStatus())).toBe('playing');
    await page.waitForTimeout(1500);
    await page.getByTestId('play').click();
    await expect.poll(() => page.evaluate(() => window.__blockwerk?.playStatus())).toBe('stopped');

    await page.keyboard.press('Control+z');
    expect(await componentCount(page, 'blockScript')).toBe(before);
    await page.keyboard.press('Control+y');
    expect(await componentCount(page, 'blockScript')).toBe(before + 1);
    expect(problems).toEqual([]);
  });

  test('five houses and a well are a ghost proposal first, then real objects in one undo step', async ({
    page,
  }) => {
    test.setTimeout(scaled(120_000));
    const L = 'kaykit-medieval-hexagon/';
    const placed = [
      ['building-home-a-blue', -8, -6],
      ['building-home-b-red', 0, -8],
      ['building-home-a-yellow', 8, -6],
      ['building-home-b-yellow', -6, 6],
      ['building-tavern-blue', 6, 6],
    ] as const;
    const { requests, problems } = await openWithKey(page, () => ({
      tool: 'propose_world',
      input: {
        summary: 'Fünf Häuser im Kreis um einen Brunnen.',
        objects: [
          ...placed.map(([model, x, z]) => ({ model: `${L}${model}`, position: [x, 0, z] })),
          { model: `${L}building-well-blue`, name: 'Brunnen', position: [0, 0, 0] },
        ],
      },
    }));
    const objectsBefore = await sceneObjectCount(page);
    await openAssistant(page);
    await ask(page, 'world', 'Stell 5 Häuser und einen Brunnen auf die Wiese');
    await expect(page.getByTestId('ai-preview')).toBeVisible();
    await expect(page.getByTestId('ai-objects').locator('li')).toHaveCount(6);
    // Ghosts in the Scene view, nothing in the scene yet.
    await expect.poll(() => page.evaluate(() => window.__blockwerk?.aiGhostCount())).toBe(6);
    expect(await sceneObjectCount(page)).toBe(objectsBefore);
    expect(requests[0]?.body.tool_choice).toEqual({ type: 'tool', name: 'propose_world' });

    await page.getByTestId('ai-apply').click();
    await expect(page.getByTestId('ai-applied')).toBeVisible();
    await expect.poll(() => page.evaluate(() => window.__blockwerk?.aiGhostCount())).toBe(0);
    expect(await sceneObjectCount(page)).toBe(objectsBefore + 6);
    expect(await objectId(page, 'Brunnen')).toBeTruthy();

    await page.keyboard.press('Control+z');
    expect(await sceneObjectCount(page)).toBe(objectsBefore);
    await page.keyboard.press('Control+y');
    expect(await sceneObjectCount(page)).toBe(objectsBefore + 6);
    expect(problems).toEqual([]);
  });

  test('a rejected proposal leaves no ghosts and changes nothing', async ({ page }) => {
    await openWithKey(page, () => ({
      tool: 'propose_world',
      input: {
        objects: [{ model: 'kaykit-medieval-hexagon/building-well-blue', position: [0, 0, 0] }],
      },
    }));
    const objectsBefore = await sceneObjectCount(page);
    await openAssistant(page);
    await ask(page, 'world', 'Ein Brunnen');
    await expect.poll(() => page.evaluate(() => window.__blockwerk?.aiGhostCount())).toBe(1);
    await page.getByTestId('ai-discard').click();
    await expect.poll(() => page.evaluate(() => window.__blockwerk?.aiGhostCount())).toBe(0);
    expect(await sceneObjectCount(page)).toBe(objectsBefore);
  });

  test('invalid answers are caught: two repairs, then an explanation and no change', async ({
    page,
  }) => {
    const { requests } = await openWithKey(page, () => ({
      tool: 'propose_script',
      input: {
        name: 'Kaputt',
        stacks: [[{ block: 'events.whenGameStarts' }, { block: 'does.notExist' }]],
      },
    }));
    await createPrimitive(page, 'sphere');
    const before = await componentCount(page, 'blockScript');
    const filesBefore = await page.evaluate(() => Object.keys(window.__blockwerk?.files() ?? {}));
    await openAssistant(page);
    await ask(page, 'logic', 'Mach etwas');
    await expect(page.getByTestId('ai-invalid')).toBeVisible();
    expect(requests).toHaveLength(3);
    // The repairs tell the model what was wrong.
    const repair = JSON.stringify(requests[1]?.body.messages);
    expect(repair).toContain('is_error');
    expect(repair).toContain('does.notExist');
    await expect(page.getByTestId('ai-apply')).toHaveCount(0);
    expect(await componentCount(page, 'blockScript')).toBe(before);
    expect(await page.evaluate(() => Object.keys(window.__blockwerk?.files() ?? {}))).toEqual(
      filesBefore,
    );
  });

  test('an answer to a question is text only, and a wrong key is explained', async ({ page }) => {
    let failing = false;
    await openWithKey(page, () =>
      failing
        ? { status: 401, message: 'invalid x-api-key' }
        : { tool: 'answer', input: { text: 'Das Skript wartet, bis der Spieler sichtbar ist.' } },
    );
    await openAssistant(page);
    await ask(page, 'explain', '');
    await expect(page.getByTestId('ai-answer')).toContainText('Spieler sichtbar');
    await expect(page.getByTestId('ai-apply')).toHaveCount(0);

    failing = true;
    await ask(page, 'explain', '');
    await expect(page.getByTestId('ai-failed')).toBeVisible();
  });
});

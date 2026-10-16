import type { Page, Route } from '@playwright/test';
import { expect } from './fixtures';

/** Mock of the Anthropic API for the editor tests: the real API is never called. */

const API = 'https://api.anthropic.com/v1/messages';
export const KEY = 'sk-ant-test-key-0000';

export interface ApiRequest {
  headers: Record<string, string>;
  body: {
    model: string;
    tool_choice?: { type: string; name: string };
    messages: { role: string; content: unknown }[];
  };
}

export type Answer = { tool: string; input: unknown } | { status: number; message: string };

/** Opens the editor with a stored key and answers the API with what `answer` returns. */
export async function openWithKey(
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

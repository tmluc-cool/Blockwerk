import type { Page } from '@playwright/test';
import { createPrimitive, expect, test } from './fixtures';

/**
 * Accessibility check of the editor (SPEC phase 11): every control has a name a screen reader can
 * read, dialogs are labeled, images have text, and everything can be reached with the keyboard.
 * (axe-core is MPL-2.0 and not allowed here, so the rules are checked directly.)
 */

interface Finding {
  rule: string;
  element: string;
}

/** Finds controls without an accessible name and other basic problems in the open page. */
async function scan(page: Page): Promise<Finding[]> {
  return page.evaluate(() => {
    const findings: { rule: string; element: string }[] = [];
    const describe = (element: Element): string => {
      const id = element.getAttribute('data-testid');
      const cls = element.getAttribute('class')?.split(' ')[0];
      return `${element.tagName.toLowerCase()}${id ? `[data-testid=${id}]` : ''}${cls ? `.${cls}` : ''}`;
    };
    const visible = (element: Element): boolean => {
      const box = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return box.width > 0 && box.height > 0 && style.visibility !== 'hidden';
    };
    const nameOf = (element: Element): string => {
      const label = element.getAttribute('aria-label');
      if (label?.trim()) return label.trim();
      const by = element.getAttribute('aria-labelledby');
      if (by) {
        const text = by
          .split(' ')
          .map((id) => document.getElementById(id)?.textContent ?? '')
          .join(' ')
          .trim();
        if (text) return text;
      }
      if (element instanceof HTMLInputElement || element instanceof HTMLSelectElement) {
        const labels = Array.from(element.labels ?? []);
        const text = labels
          .map((item) => item.textContent ?? '')
          .join(' ')
          .trim();
        if (text) return text;
      }
      if (element instanceof HTMLTextAreaElement) {
        const text = Array.from(element.labels ?? [])
          .map((item) => item.textContent ?? '')
          .join(' ')
          .trim();
        if (text) return text;
      }
      const title = element.getAttribute('title');
      if (title?.trim()) return title.trim();
      if (element instanceof HTMLInputElement && element.type !== 'text') {
        if (element.type === 'button' || element.type === 'submit') return element.value;
      }
      const text = (element.textContent ?? '').trim();
      if (text) return text;
      const img = element.querySelector('img[alt], svg[aria-label], svg title');
      if (img) return 'image';
      return '';
    };
    const controls = document.querySelectorAll(
      'button, a[href], input:not([type=hidden]), select, textarea, [role=button], [role=tab], [role=menuitem], [role=checkbox], [role=radio], [role=slider], [role=switch]',
    );
    for (const element of controls) {
      if (!visible(element)) continue;
      if (element.closest('[aria-hidden=true], [inert]')) continue;
      if (!nameOf(element)) findings.push({ rule: 'control-has-name', element: describe(element) });
    }
    for (const image of document.querySelectorAll('img')) {
      if (!visible(image)) continue;
      if (!image.hasAttribute('alt')) {
        findings.push({ rule: 'image-has-alt', element: describe(image) });
      }
    }
    for (const dialog of document.querySelectorAll('[role=dialog], [role=alertdialog]')) {
      if (!visible(dialog)) continue;
      if (!nameOf(dialog) || !dialog.hasAttribute('aria-label')) {
        const labelled = dialog.getAttribute('aria-labelledby');
        if (!dialog.getAttribute('aria-label') && !labelled) {
          findings.push({ rule: 'dialog-has-name', element: describe(dialog) });
        }
      }
    }
    const lang = document.documentElement.getAttribute('lang');
    if (!lang) findings.push({ rule: 'html-has-lang', element: 'html' });
    return findings;
  });
}

const PANELS = [
  'scene',
  'game',
  'inspector',
  'hierarchy',
  'project',
  'blockEditor',
  'dialogEditor',
  'uiEditor',
  'search',
  'figure',
  'lighting',
  'navigation',
  'profiler',
  'buildSettings',
  'assetLibrary',
  'console',
];

test.describe('accessibility', () => {
  test('every window has no unnamed controls, and the page has a language', async ({
    editor: page,
  }) => {
    test.setTimeout(120_000);
    // An object with components, so that the Inspector shows real fields.
    await createPrimitive(page, 'cube');
    const problems: string[] = [];
    for (const panel of PANELS) {
      await page.getByTestId('menu-window').click();
      await page.getByTestId('menu-open-window').hover();
      await page.getByTestId(`open-${panel}`).click();
      await page.waitForTimeout(300);
      for (const finding of await scan(page)) {
        problems.push(`${panel}: ${finding.rule} ${finding.element}`);
      }
    }
    expect([...new Set(problems)]).toEqual([]);
  });

  test('the preferences dialog and its key field are labeled', async ({ editor: page }) => {
    await page.getByTestId('menu-edit').click();
    await page.getByTestId('menu-preferences').click();
    await expect(page.getByTestId('preferences-dialog')).toBeVisible();
    expect(await scan(page)).toEqual([]);
  });

  test('the keyboard reaches menus, toolbar and windows, and the focus is visible', async ({
    editor: page,
  }) => {
    const seen = new Set<string>();
    const hidden: string[] = [];
    for (let step = 0; step < 70; step++) {
      await page.keyboard.press('Tab');
      const info = await page.evaluate(() => {
        const element = document.activeElement;
        if (!element || element === document.body) return null;
        const style = getComputedStyle(element);
        const outline = style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0;
        const shadow = style.boxShadow !== 'none';
        const id = element.getAttribute('data-testid') ?? element.tagName.toLowerCase();
        return { id, visible: outline || shadow, tag: element.tagName.toLowerCase() };
      });
      if (!info) continue;
      seen.add(info.id);
      if (!info.visible) hidden.push(info.id);
    }
    // The menu bar, the toolbar and the windows can all be reached.
    expect(seen.size).toBeGreaterThan(15);
    expect(seen).toContain('menu-file');
    expect(seen).toContain('play');
    expect([...new Set(hidden)]).toEqual([]);
  });
});

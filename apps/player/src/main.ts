import type { GamePack } from '@blockwerk/export/pack';
import { loadGame } from './load';
import type { LoadedGame } from './load';
import type { PlayerSession } from './session';
import { playerShell } from './shell';
import { detectLocale, playerText } from './texts';

const locale = detectLocale();
const app = document.getElementById('app');

/** A full-screen cover with a title, a bar, and an optional picture or button. */
function cover(): {
  readonly root: HTMLElement;
  setTitle(text: string): void;
  setProgress(share: number): void;
  setSplash(url: string): void;
  showButton(text: string, onClick: () => void): void;
  fail(text: string): void;
  remove(): void;
} {
  const root = document.createElement('div');
  root.dataset['testid'] = 'player-cover';
  root.style.cssText =
    'position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;' +
    'justify-content:center;gap:18px;background:#101216 center/contain no-repeat;z-index:10';
  const title = document.createElement('div');
  title.dataset['testid'] = 'player-title';
  title.style.cssText =
    'font-size:22px;text-shadow:0 1px 6px #000;padding:6px 14px;background:#0008;border-radius:6px';
  const bar = document.createElement('div');
  bar.style.cssText = 'width:min(360px,70vw);height:8px;background:#fff3;border-radius:4px';
  const fill = document.createElement('div');
  fill.dataset['testid'] = 'player-progress';
  fill.style.cssText = 'height:100%;width:0;background:#e8a33d;border-radius:4px';
  bar.appendChild(fill);
  root.append(title, bar);
  app?.appendChild(root);
  return {
    root,
    setTitle: (text) => {
      title.textContent = text;
    },
    setProgress: (share) => {
      fill.style.width = `${Math.round(share * 100)}%`;
    },
    setSplash: (url) => {
      root.style.backgroundImage = `url(${url})`;
    },
    showButton: (text, onClick) => {
      bar.remove();
      const button = document.createElement('button');
      button.dataset['testid'] = 'player-start';
      button.textContent = text;
      button.style.cssText =
        'font-size:20px;padding:12px 28px;border:0;border-radius:8px;background:#e8a33d;' +
        'color:#1a1204;cursor:pointer';
      button.addEventListener('click', onClick);
      root.appendChild(button);
      button.focus();
    },
    fail: (text) => {
      bar.remove();
      title.textContent = text;
      title.dataset['testid'] = 'player-error';
      title.style.background = '#7a1c1c';
    },
    remove: () => root.remove(),
  };
}

async function main(): Promise<void> {
  if (!app) return;
  const screen = cover();
  screen.setTitle(playerText(locale, 'loading', { name: 'Blockwerk' }));
  let loaded: LoadedGame;
  try {
    const base = new URL('game/', document.baseURI).toString();
    // The engine is the big part of the download: the loading screen shows before it arrives.
    const { initEngine } = await import('./session');
    const engine = initEngine();
    loaded = await loadGame(
      base,
      (done) => screen.setProgress(done),
      (pack: GamePack) => {
        document.title = pack.name;
        screen.setTitle(playerText(locale, 'loading', { name: pack.name }));
      },
    );
    await engine;
    const splash = loaded.pack.splash ? loaded.urls.get(loaded.pack.splash) : undefined;
    if (splash) screen.setSplash(splash);
  } catch (error) {
    console.error(error);
    screen.fail(playerText(locale, 'failed'));
    return;
  }
  let session: PlayerSession;
  try {
    const { PlayerSession: Session } = await import('./session');
    session = new Session(app, loaded, locale);
  } catch (error) {
    console.error(error);
    const webgl = error instanceof Error && /webgl/i.test(error.message);
    screen.fail(playerText(locale, webgl ? 'noGraphics' : 'failed'));
    return;
  }
  window.__blockwerkPlayer = () => session.hooks();
  const begin = (): void => {
    screen.remove();
    session.start();
  };
  // The Windows app may play sound without a click; a browser needs one.
  if (playerShell()) begin();
  else screen.showButton(playerText(locale, 'start'), begin);
}

void main();

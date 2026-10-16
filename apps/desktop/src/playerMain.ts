import { app, BrowserWindow, ipcMain, Menu, net, protocol, session } from 'electron';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, normalize, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * Shell of an exported Windows game (SPEC 9.3): a window that shows the player page and the game
 * pack from the app's `resources/` folder. No menu, fullscreen as the build asks, no network,
 * no editor. `BLOCKWERK_PLAYER_SMOKE=<file>` makes it write a short report once the game runs
 * and quit (used by the tests of the export).
 */

const SCHEME = 'blockwerk-game';
const ORIGIN = `${SCHEME}://game`;
const BACKGROUND = '#000000';

const playerDir = normalize(
  process.env['BLOCKWERK_PLAYER_DIR'] ?? join(process.resourcesPath, 'player'),
);
const gameDir = normalize(process.env['BLOCKWERK_GAME_DIR'] ?? join(process.resourcesPath, 'game'));

/** Content Security Policy: everything local; scripts of the game need `eval`. */
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-eval' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "media-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' data: blob:",
  "object-src 'none'",
  "base-uri 'self'",
].join('; ');

app.commandLine.appendSwitch('enable-unsafe-swiftshader');
// Sound starts without a click (the game is a native app, not a web page).
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

protocol.registerSchemesAsPrivileged([
  { scheme: SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

interface PackHeader {
  readonly name?: string;
  readonly window?: 'fullscreen' | 'windowed';
  readonly icon?: string;
  readonly files?: Readonly<Record<string, { readonly path: string }>>;
}

/** The name and window mode of the game, read from `game.json` before the page loads. */
function readHeader(): PackHeader {
  try {
    return JSON.parse(readFileSync(join(gameDir, 'game.json'), 'utf8')) as PackHeader;
  } catch {
    return {};
  }
}

/** Serves the player page and, below `game/`, the game pack. Nothing else. */
function registerProtocol(): void {
  protocol.handle(SCHEME, async (request) => {
    const { host, pathname } = new URL(request.url);
    const relative = decodeURIComponent(pathname).replace(/^\/+/, '') || 'index.html';
    const isGame = relative.startsWith('game/');
    const root = isGame ? gameDir : playerDir;
    const file = normalize(join(root, isGame ? relative.slice('game/'.length) : relative));
    if (host !== 'game' || !file.startsWith(root + sep) || !existsSync(file)) {
      return new Response('Not found', { status: 404 });
    }
    const response = await net.fetch(pathToFileURL(file).toString());
    const headers = new Headers(response.headers);
    headers.set('Content-Security-Policy', CONTENT_SECURITY_POLICY);
    if (file.endsWith('.wasm')) headers.set('Content-Type', 'application/wasm');
    return new Response(response.body, { status: response.status, headers });
  });
}

/** What the page reports (see `PlayerHooks` in `apps/player`). */
interface PageState {
  readonly state: string;
  readonly tick: number;
  readonly problems: readonly string[];
  readonly fullscreenRequested: boolean;
}

/** Waits until the game runs, writes a report to `file` and quits. */
function smokeTest(window: BrowserWindow, file: string, blocked: string[]): void {
  const started = Date.now();
  const poll = async (): Promise<void> => {
    let state: PageState | null = null;
    try {
      state = (await window.webContents.executeJavaScript(
        'window.__blockwerkPlayer ? window.__blockwerkPlayer() : null',
      )) as PageState | null;
    } catch {
      state = null;
    }
    const timedOut = Date.now() - started > 120_000;
    if ((state && state.tick >= 30) || timedOut) {
      writeFileSync(
        file,
        JSON.stringify({
          ok: Boolean(state && state.tick >= 30),
          state,
          fullScreen: window.isFullScreen(),
          title: window.getTitle(),
          menuBar: window.isMenuBarVisible(),
          blockedRequests: blocked,
          editorFiles: existsSync(join(playerDir, 'blocks.html')),
        }),
      );
      app.quit();
      return;
    }
    setTimeout(() => void poll(), 500);
  };
  void poll();
}

void app.whenReady().then(() => {
  registerProtocol();
  const header = readHeader();
  const blocked: string[] = [];
  // The game never reaches the network: only the player's own protocol, data and blob URLs.
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    // The protocol handler reads the game's own files through `file:` URLs; nothing else may.
    const own = [playerDir, gameDir].map((dir) => pathToFileURL(dir + sep).href.toLowerCase());
    const allowed =
      /^(blockwerk-game|data|blob|devtools|chrome-extension):/.test(details.url) ||
      (details.url.startsWith('file:') &&
        own.some((prefix) => details.url.toLowerCase().startsWith(prefix)));
    if (!allowed) blocked.push(details.url);
    callback({ cancel: !allowed });
  });
  Menu.setApplicationMenu(null);
  const iconPath = join(process.resourcesPath, 'icon.png');
  const window = new BrowserWindow({
    width: 1280,
    height: 720,
    show: false,
    backgroundColor: BACKGROUND,
    title: header.name ?? 'Blockwerk',
    autoHideMenuBar: true,
    fullscreen: header.window !== 'windowed',
    ...(existsSync(iconPath) ? { icon: iconPath } : {}),
    webPreferences: {
      preload: join(__dirname, 'playerPreload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      devTools: false,
    },
  });
  window.once('ready-to-show', () => window.show());
  // The title stays the game's name, whatever the page says.
  window.on('page-title-updated', (event) => event.preventDefault());
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(`${ORIGIN}/`)) event.preventDefault();
  });
  ipcMain.on('player:fullscreen', (_event, on: boolean) => window.setFullScreen(Boolean(on)));
  ipcMain.on('player:quit', () => app.quit());
  const smoke = process.env['BLOCKWERK_PLAYER_SMOKE'];
  if (smoke) smokeTest(window, smoke, blocked);
  void window.loadURL(`${ORIGIN}/index.html`);
});

app.on('window-all-closed', () => app.quit());

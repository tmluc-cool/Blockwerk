import { app, BrowserWindow, Menu, net, protocol } from 'electron';
import type { BrowserWindowConstructorOptions } from 'electron';
import { join, normalize, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * Electron shell of the Blockwerk editor. The built editor is served from the custom
 * `blockwerk://app/` protocol, so the main window and detached windows share one origin.
 * Set `BLOCKWERK_EDITOR_URL` to load a dev server instead (see `pnpm dev:desktop`).
 */

const SCHEME = 'blockwerk';
const APP_ORIGIN = `${SCHEME}://app`;
const BACKGROUND = '#17191d';

/** Content Security Policy of the editor: everything local, no network access. */
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "media-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' data: blob:",
  "object-src 'none'",
  "base-uri 'self'",
].join('; ');

const devServerUrl = process.env['BLOCKWERK_EDITOR_URL'];
const editorDist = normalize(
  process.env['BLOCKWERK_EDITOR_DIST'] ?? join(__dirname, '..', '..', 'editor', 'dist'),
);

// Tests use a fresh profile directory to check that layouts survive restarts.
const userData = process.env['BLOCKWERK_USER_DATA'];
if (userData) app.setPath('userData', userData);

// Fall back to software rendering when the GPU is missing or blocklisted, so the 3D views
// always work. Safe here because the app only loads its own local content.
app.commandLine.appendSwitch('enable-unsafe-swiftshader');

protocol.registerSchemesAsPrivileged([
  { scheme: SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

/** Whether a URL belongs to the editor (and may be opened in an editor window). */
function isEditorUrl(url: string): boolean {
  if (devServerUrl) return url.startsWith(new URL(devServerUrl).origin);
  return url.startsWith(`${APP_ORIGIN}/`);
}

/** Serves files of the built editor for `blockwerk://app/...` requests. */
function registerEditorProtocol(): void {
  protocol.handle(SCHEME, async (request) => {
    const { host, pathname } = new URL(request.url);
    const relative = decodeURIComponent(pathname).replace(/^\/+/, '') || 'index.html';
    const file = normalize(join(editorDist, relative));
    if (host !== 'app' || !file.startsWith(editorDist + sep)) {
      return new Response('Not found', { status: 404 });
    }
    const response = await net.fetch(pathToFileURL(file).toString());
    const headers = new Headers(response.headers);
    headers.set('Content-Security-Policy', CONTENT_SECURITY_POLICY);
    return new Response(response.body, { status: response.status, headers });
  });
}

/** Options shared by the main window and detached editor windows. */
function windowOptions(): BrowserWindowConstructorOptions {
  return {
    backgroundColor: BACKGROUND,
    title: 'Blockwerk',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  };
}

function createMainWindow(): BrowserWindow {
  const window = new BrowserWindow({
    ...windowOptions(),
    width: 1600,
    height: 960,
    minWidth: 960,
    minHeight: 600,
    show: false,
  });
  // Detached panels (dockview popouts) open as editor windows; anything else is blocked.
  window.webContents.setWindowOpenHandler(({ url }) =>
    isEditorUrl(url)
      ? { action: 'allow', overrideBrowserWindowOptions: windowOptions() }
      : { action: 'deny' },
  );
  window.webContents.on('will-navigate', (event, url) => {
    if (!isEditorUrl(url)) event.preventDefault();
  });
  window.once('ready-to-show', () => window.show());
  void window.loadURL(devServerUrl ?? `${APP_ORIGIN}/index.html`);
  return window;
}

void app.whenReady().then(() => {
  // The menu bar is part of the editor UI (same in browser and desktop).
  Menu.setApplicationMenu(null);
  if (!devServerUrl) registerEditorProtocol();
  createMainWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

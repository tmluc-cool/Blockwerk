import { contextBridge } from 'electron';

/** Information the desktop shell exposes to the editor as `window.blockwerkDesktop`. */
export interface DesktopInfo {
  readonly platform: string;
  readonly electron: string;
}

const info: DesktopInfo = {
  platform: process.platform,
  electron: process.versions['electron'] ?? '',
};

contextBridge.exposeInMainWorld('blockwerkDesktop', info);

import { contextBridge, ipcRenderer } from 'electron';

/** What the exported game's page may ask of its window: fullscreen and quit, nothing else. */
contextBridge.exposeInMainWorld('blockwerkPlayerShell', {
  fullscreen: (on: boolean): void => ipcRenderer.send('player:fullscreen', on),
  quit: (): void => ipcRenderer.send('player:quit'),
});

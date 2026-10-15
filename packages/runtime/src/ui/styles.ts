/** Style of the UI layer (injected once into the page that shows the game). */
export const UI_CSS = `
.bw-ui { position: absolute; inset: 0; overflow: hidden; pointer-events: none; user-select: none;
  font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; color: #fff; }
.bw-ui-view { position: absolute; overflow: hidden; pointer-events: none; }
.bw-ui-el { position: absolute; box-sizing: border-box; pointer-events: none; overflow: hidden;
  display: flex; align-items: center; justify-content: center; white-space: pre-wrap; }
.bw-ui-el[data-type="panel"], .bw-ui-el[data-type="inventory"] { overflow: visible; }
.bw-ui-bar-fill { position: absolute; left: 0; top: 0; bottom: 0; }
.bw-ui-el button, .bw-ui-el input, .bw-ui-el select { pointer-events: auto; font: inherit; }
.bw-ui-btn { width: 100%; height: 100%; border: 1px solid rgba(255,255,255,0.35); border-radius: 6px;
  background: rgba(30,34,44,0.9); color: inherit; cursor: pointer; }
.bw-ui-btn:hover { background: rgba(70,90,140,0.95); }
.bw-ui-el input[type="range"] { width: 100%; }
.bw-ui-keys { display: grid; grid-template-columns: 1fr auto 1fr auto; gap: 4px 12px; width: 100%; height: 100%;
  overflow: auto; align-content: start; padding: 4px; pointer-events: auto; }
.bw-ui-keys span { text-align: left; align-self: center; }
.bw-ui-keys button { min-width: 90px; border: 1px solid rgba(255,255,255,0.35); border-radius: 4px;
  background: rgba(30,34,44,0.9); color: inherit; cursor: pointer; }
.bw-ui-keys button.capturing { outline: 2px solid #4a8cff; }
.bw-ui-list { display: flex; flex-direction: column; gap: 2px; width: 100%; align-self: flex-start; }
.bw-ui-dialog { display: flex; flex-direction: column; align-items: stretch; width: 100%; height: 100%;
  padding: 12px 16px; background: rgba(10,12,16,0.88); border-radius: 8px; overflow: auto; }
.bw-ui-dialog .speaker { font-weight: 700; margin-bottom: 4px; }
.bw-ui-dialog .text { margin-bottom: 8px; white-space: pre-wrap; }
.bw-ui-dialog button { display: block; width: 100%; margin-top: 4px; text-align: left; padding: 4px 8px;
  border: 1px solid rgba(255,255,255,0.25); border-radius: 4px; background: rgba(40,44,54,0.9);
  color: inherit; cursor: pointer; pointer-events: auto; }
.bw-ui-dialog button.selected { outline: 2px solid #4a8cff; }
.bw-ui-hint { padding: 6px 14px; border-radius: 6px; background: rgba(10,12,16,0.78); }
.bw-ui-crosshair::before, .bw-ui-crosshair::after { content: ''; position: absolute; background: #fff; }
.bw-ui-crosshair::before { left: 50%; top: 25%; bottom: 25%; width: 2px; transform: translateX(-50%); }
.bw-ui-crosshair::after { top: 50%; left: 25%; right: 25%; height: 2px; transform: translateY(-50%); }
.bw-ui-loading { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center;
  justify-content: center; gap: 16px; padding: 24px; background: #0b0d12; text-align: center;
  pointer-events: auto; }
.bw-ui-loading-bar { width: min(360px, 70%); height: 8px; border-radius: 4px;
  background: rgba(255,255,255,0.15); overflow: hidden; }
.bw-ui-loading-fill { height: 100%; background: #4a8cff; transition: width 0.1s linear; }
.bw-ui-notice { position: absolute; left: 50%; top: 24px; transform: translateX(-50%);
  padding: 6px 16px; border-radius: 6px; background: rgba(10,12,16,0.85); }
`;

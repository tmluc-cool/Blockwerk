import 'dockview-react/dist/styles/dockview.css';
import './styles.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { initNavigation, initPhysics } from '@blockwerk/runtime';
import { App } from './App';
import { installShortcuts } from './shortcuts';
import { installAutosave } from './state/autosave';
import { useConsole } from './state/console';
import { bootstrap } from './state/document';
import { installTestHooks } from './testHooks';

const root = document.getElementById('root');
if (root) {
  installTestHooks();
  installShortcuts(window);
  installAutosave(window);
  useConsole.getState().log('info', 'console.editorStarted');
  void bootstrap();
  // Load the physics engine in the background so the first Play starts at once.
  void initPhysics().catch(() => undefined);
  void initNavigation().catch(() => undefined);
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

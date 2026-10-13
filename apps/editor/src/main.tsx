import 'dockview-react/dist/styles/dockview.css';
import './styles.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { installShortcuts } from './shortcuts';
import { useConsole } from './state/console';
import { installTestHooks } from './testHooks';

const root = document.getElementById('root');
if (root) {
  installTestHooks();
  installShortcuts(window);
  useConsole.getState().log('info', 'console.editorStarted');
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

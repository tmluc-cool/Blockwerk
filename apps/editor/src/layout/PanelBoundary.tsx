import type { IDockviewPanelProps } from 'dockview-react';
import { Component } from 'react';
import type { ErrorInfo, FunctionComponent, ReactNode } from 'react';
import { useConsole } from '../state/console';
import { t } from '../state/settings';
import { panelDefinition } from './panels';

interface BoundaryProps {
  readonly panelId: string;
  readonly children: ReactNode;
}

interface BoundaryState {
  readonly error: Error | null;
}

/** Catches errors of one window so a broken window never takes down the whole editor. */
class PanelBoundary extends Component<BoundaryProps, BoundaryState> {
  override state: BoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error, _info: ErrorInfo): void {
    const definition = panelDefinition(this.props.panelId);
    useConsole.getState().log('error', 'panel.failedLog', {
      panel: definition ? t(definition.titleKey) : this.props.panelId,
      message: error.message,
    });
  }

  override render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;
    const webgl = /webgl/i.test(error.message);
    return (
      <div className="panel">
        <div className="empty-hint" role="alert">
          {webgl ? t('scene.webglMissing') : t('panel.failed')}
        </div>
      </div>
    );
  }
}

/** Wraps a window component in an error boundary. */
export function withPanelBoundary(
  panelId: string,
  Panel: FunctionComponent<IDockviewPanelProps>,
): FunctionComponent<IDockviewPanelProps> {
  const Wrapped = (props: IDockviewPanelProps) => (
    <PanelBoundary panelId={panelId}>
      <Panel {...props} />
    </PanelBoundary>
  );
  Wrapped.displayName = `Panel(${panelId})`;
  return Wrapped;
}

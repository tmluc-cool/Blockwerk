import { CircleAlert, Info, TriangleAlert } from 'lucide-react';
import type { IDockviewPanelProps } from 'dockview-react';
import type { ReactElement } from 'react';
import { revealLink } from '../navigation';
import { useConsole, visibleRows } from '../state/console';
import type { LogLevel } from '../state/console';
import { useSettings, useT } from '../state/settings';

const LEVEL_ICONS: Readonly<Record<LogLevel, ReactElement>> = {
  info: <Info size={14} />,
  warning: <TriangleAlert size={14} />,
  error: <CircleAlert size={14} />,
};

/** Console window (Unity: Console) with Clear, Collapse, Error Pause and level filters. */
export function ConsolePanel(_props: IDockviewPanelProps) {
  const t = useT();
  const locale = useSettings((state) => state.locale);
  const {
    entries,
    collapse,
    errorPause,
    show,
    clear,
    toggleCollapse,
    toggleErrorPause,
    toggleLevel,
  } = useConsole();
  const rows = visibleRows(entries, show, collapse);
  const counts: Record<LogLevel, number> = { info: 0, warning: 0, error: 0 };
  for (const entry of entries) counts[entry.level]++;
  const time = new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return (
    <div className="panel console" data-testid="console">
      <div className="panel-toolbar">
        <button type="button" onClick={clear}>
          {t('console.clear')}
        </button>
        <button
          type="button"
          className={collapse ? 'toggled' : ''}
          aria-pressed={collapse}
          onClick={toggleCollapse}
        >
          {t('console.collapse')}
        </button>
        <button
          type="button"
          className={errorPause ? 'toggled' : ''}
          aria-pressed={errorPause}
          onClick={toggleErrorPause}
        >
          {t('console.errorPause')}
        </button>
        <span className="toolbar-spacer" />
        {(['info', 'warning', 'error'] as const).map((level) => (
          <button
            key={level}
            type="button"
            className={`level-toggle level-${level}${show[level] ? ' toggled' : ''}`}
            aria-pressed={show[level]}
            title={t(
              level === 'info'
                ? 'console.filterInfo'
                : level === 'warning'
                  ? 'console.filterWarning'
                  : 'console.filterError',
            )}
            onClick={() => toggleLevel(level)}
          >
            {LEVEL_ICONS[level]}
            {counts[level]}
          </button>
        ))}
      </div>
      <div className="console-list" role="log" tabIndex={0}>
        {rows.length === 0 && <div className="empty-hint">{t('console.empty')}</div>}
        {rows.map(({ entry, count }) => (
          <div
            key={entry.id}
            className={`console-row level-${entry.level}${entry.link ? ' linked' : ''}`}
            title={entry.link ? t('console.jumpHint') : undefined}
            data-testid="console-row"
            onClick={() => entry.link && revealLink(entry.link)}
          >
            {LEVEL_ICONS[entry.level]}
            <span className="console-time">{time.format(entry.time)}</span>
            <span className="console-message">{t(entry.key, entry.params)}</span>
            {count > 1 && <span className="badge">{count}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

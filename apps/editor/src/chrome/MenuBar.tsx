import { useState } from 'react';
import { useLayout } from '../layout/layoutController';
import { useSettings, useT } from '../state/settings';
import { MenuButton } from './Menu';
import { menuBarMenus } from './menus';

/** Menu bar at the top of the editor. Hovering moves between menus once one is open. */
export function MenuBar() {
  const t = useT();
  // Re-render when settings or saved layouts change so checkmarks and lists stay current.
  useSettings((state) => state.theme);
  useLayout((state) => state.named);
  const [openId, setOpenId] = useState<string | null>(null);
  const menus = menuBarMenus(t);
  return (
    <nav className="menu-bar" data-testid="menu-bar">
      <span className="brand">{t('app.name')}</span>
      {menus.map((menu) => (
        <MenuButton
          key={menu.id}
          label={menu.label}
          items={menu.items}
          testId={`menu-${menu.id}`}
          open={openId === menu.id}
          onOpenChange={(open) => setOpenId(open ? menu.id : null)}
          onHover={() => {
            if (openId !== null && openId !== menu.id) setOpenId(menu.id);
          }}
        />
      ))}
    </nav>
  );
}

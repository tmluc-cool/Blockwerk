import { useEffect, useRef } from 'react';
import { MenuList } from './Menu';
import type { MenuItem } from './Menu';

/** Position and entries of an open context menu. */
export interface ContextMenuState {
  readonly x: number;
  readonly y: number;
  readonly items: readonly MenuItem[];
}

/** A right-click menu at a position. Closes on outside click and Escape. */
export function ContextMenu({ menu, onClose }: { menu: ContextMenuState; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const doc = ref.current?.ownerDocument ?? document;
    const onPointerDown = (event: PointerEvent): void => {
      if (!ref.current?.contains(event.target as Node)) onClose();
    };
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose();
    };
    doc.addEventListener('pointerdown', onPointerDown);
    doc.addEventListener('keydown', onKey);
    return () => {
      doc.removeEventListener('pointerdown', onPointerDown);
      doc.removeEventListener('keydown', onKey);
    };
  }, [onClose]);
  return (
    <div
      ref={ref}
      className="menu-popup context-menu"
      data-testid="context-menu"
      style={{ position: 'fixed', left: menu.x, top: menu.y }}
    >
      <MenuList items={menu.items} onClose={onClose} />
    </div>
  );
}

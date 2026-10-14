import { Check, ChevronRight } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

/** One entry of a dropdown menu. */
export type MenuItem =
  | {
      readonly kind?: 'item';
      readonly label: string;
      readonly shortcut?: string;
      readonly disabled?: boolean;
      readonly checked?: boolean;
      readonly testId?: string;
      readonly action?: () => void;
      readonly submenu?: readonly MenuItem[];
    }
  | { readonly kind: 'separator' };

interface MenuListProps {
  readonly items: readonly MenuItem[];
  readonly onClose: () => void;
}

/** A dropdown list with optional nested submenus (opened on hover). */
export function MenuList({ items, onClose }: MenuListProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  return (
    <div className="menu-list" role="menu">
      {items.map((item, index) => {
        if (item.kind === 'separator')
          return <div key={index} className="menu-separator" role="separator" />;
        const hasSubmenu = item.submenu !== undefined;
        return (
          <div
            key={index}
            role="menuitem"
            aria-disabled={item.disabled}
            data-testid={item.testId}
            className={`menu-item${item.disabled ? ' disabled' : ''}${openIndex === index ? ' open' : ''}`}
            onMouseEnter={() => setOpenIndex(hasSubmenu ? index : null)}
            onClick={(event) => {
              event.stopPropagation();
              if (item.disabled) return;
              if (hasSubmenu) {
                setOpenIndex(index);
                return;
              }
              onClose();
              item.action?.();
            }}
          >
            <span className="menu-check">{item.checked && <Check size={13} />}</span>
            <span className="menu-label">{item.label}</span>
            {item.shortcut && <span className="menu-shortcut">{item.shortcut}</span>}
            {hasSubmenu && <ChevronRight size={13} className="menu-arrow" />}
            {hasSubmenu && openIndex === index && item.submenu && (
              <div className="submenu">
                <MenuList items={item.submenu} onClose={onClose} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

interface MenuButtonProps {
  readonly label: React.ReactNode;
  readonly items: readonly MenuItem[];
  readonly className?: string;
  readonly title?: string;
  readonly testId?: string;
  /** Shared state so hovering moves between open top-level menus (menu bar behavior). */
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onHover?: () => void;
}

/** A button that opens a dropdown menu. Closes on outside click and Escape. */
export function MenuButton({
  label,
  items,
  className,
  title,
  testId,
  open,
  onOpenChange,
  onHover,
}: MenuButtonProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const doc = rootRef.current?.ownerDocument ?? document;
    const onPointerDown = (event: PointerEvent): void => {
      if (!rootRef.current?.contains(event.target as Node)) onOpenChange(false);
    };
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onOpenChange(false);
    };
    doc.addEventListener('pointerdown', onPointerDown);
    doc.addEventListener('keydown', onKey);
    return () => {
      doc.removeEventListener('pointerdown', onPointerDown);
      doc.removeEventListener('keydown', onKey);
    };
  }, [open, onOpenChange]);

  return (
    <div className={`menu-root${open ? ' open' : ''}`} ref={rootRef} onMouseEnter={onHover}>
      <button
        type="button"
        className={className ?? 'menu-button'}
        title={title}
        data-testid={testId}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => onOpenChange(!open)}
      >
        {label}
      </button>
      {open && (
        <div className="menu-popup">
          <MenuList items={items} onClose={() => onOpenChange(false)} />
        </div>
      )}
    </div>
  );
}

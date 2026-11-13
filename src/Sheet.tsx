import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { IconClose } from "./icons";

/*
  Bottom sheet, built from the Figma "Bottom sheet" component (J1, J2, J3, J5).
  Motion follows the v03 tokens: opens 300ms ease-out, closes 240ms ease-out,
  sheet-to-sheet morphs height 300ms ease-in-out, scrim fades to 40%.
  Back (Esc), a scrim tap or the X dismisses it.
*/

export const SHEET_CLOSE_MS = 240;

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

export function BottomSheet({
  closing,
  onDismiss,
  labelledBy,
  contentKey,
  children,
}: {
  closing: boolean;
  onDismiss: () => void;
  labelledBy: string;
  contentKey: string;
  children: ReactNode;
}) {
  const [shown, setShown] = useState(false);
  const [height, setHeight] = useState<number | undefined>(undefined);
  const sheetRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const opener = useRef<Element | null>(null);

  // Mount closed, then open on the next frame so the slide-up runs.
  useEffect(() => {
    opener.current = document.activeElement;
    let r2 = 0;
    const r1 = requestAnimationFrame(() => {
      r2 = requestAnimationFrame(() => setShown(true));
    });
    return () => {
      cancelAnimationFrame(r1);
      cancelAnimationFrame(r2);
      if (opener.current instanceof HTMLElement && document.contains(opener.current)) opener.current.focus();
    };
  }, []);

  // Track content height so a sheet-to-sheet change morphs instead of jumping.
  useLayoutEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setHeight(el.offsetHeight));
    ro.observe(el);
    setHeight(el.offsetHeight);
    return () => ro.disconnect();
  }, []);

  // Move focus into the sheet when it opens and whenever its content changes.
  useEffect(() => {
    if (!shown) return;
    const first = innerRef.current?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? sheetRef.current)?.focus({ preventScroll: true });
  }, [shown, contentKey]);

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Escape") {
      e.stopPropagation();
      onDismiss();
      return;
    }
    if (e.key !== "Tab" || !sheetRef.current) return;
    const items = Array.from(sheetRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((n) => n.offsetParent !== null);
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  const state = closing ? "closing" : shown ? "open" : "";
  return (
    <>
      <div className={`scrim ${state}`} onClick={onDismiss} aria-hidden="true" />
      <div
        ref={sheetRef}
        className={`sheet ${state}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        onKeyDown={onKeyDown}
      >
        <div className="sheet-handle" aria-hidden="true" />
        <div className="sheet-morph" style={{ height }}>
          <div ref={innerRef}>
            <div key={contentKey} className="sheet-swap">
              {children}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/* Header with title and close (Figma: Add invoice, Reminder actions). */
export function SheetHeader({ id, title, onClose }: { id: string; title: string; onClose: () => void }) {
  return (
    <div className="sheet-header">
      <h2 id={id} className="sheet-header-title">
        {title}
      </h2>
      <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
        <IconClose />
      </button>
    </div>
  );
}

/* Sheet row (Figma SheetRow): icon + label, 56px tall. */
export function SheetRow({
  icon,
  label,
  onClick,
  destructive,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  destructive?: boolean;
}) {
  return (
    <button type="button" className={`sheet-row ${destructive ? "destructive" : ""}`} onClick={onClick}>
      <span className="sheet-row-icon">{icon}</span>
      <span>{label}</span>
    </button>
  );
}

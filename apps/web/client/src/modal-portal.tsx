import { createPortal } from "react-dom";
import { useEffect, useRef, type KeyboardEvent, type ReactNode } from "react";

const focusableSelector = [
  "button:not([disabled])",
  "[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");
let openPortals = 0;
let originalOverflow = "";

export function ModalPortal({ children }: { children: ReactNode }) {
  const layer = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (typeof document === "undefined") return;
    returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (openPortals++ === 0) {
      originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }
    const first = layer.current?.querySelector<HTMLElement>("[autofocus]," + focusableSelector);
    window.requestAnimationFrame(() => first?.focus());
    return () => {
      if (--openPortals === 0) document.body.style.overflow = originalOverflow;
      window.requestAnimationFrame(() => returnFocus.current?.focus());
    };
  }, []);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      const dialog = layer.current?.querySelector<HTMLDialogElement>("dialog");
      if (dialog?.open && typeof dialog.close === "function") dialog.close();
      else {
        const buttons = [...(layer.current?.querySelectorAll<HTMLButtonElement>("button") ?? [])];
        const closeControl = buttons.find(button =>
          button.hasAttribute("data-modal-close") ||
          button.getAttribute("aria-label")?.toLowerCase().startsWith("close") ||
          /^(close|cancel)$/i.test(button.textContent?.trim() ?? ""),
        );
        closeControl?.click();
      }
      return;
    }
    if (event.key !== "Tab") return;
    const controls = [...(layer.current?.querySelectorAll<HTMLElement>(focusableSelector) ?? [])]
      .filter(control => control.offsetParent !== null);
    if (!controls.length) return;
    const first = controls[0], last = controls.at(-1)!;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="vynode-nested-modal-layer" ref={layer} onKeyDown={onKeyDown}>{children}</div>,
    document.body,
  );
}

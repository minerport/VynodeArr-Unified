import { createPortal } from "react-dom";
import type { ReactNode } from "react";

export function ModalPortal({ children }: { children: ReactNode }) {
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="vynode-nested-modal-layer">{children}</div>,
    document.body,
  );
}

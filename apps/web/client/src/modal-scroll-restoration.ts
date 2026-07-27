type PagePosition = {
  hash: string;
  x: number;
  y: number;
};

const MODAL_SELECTOR = [
  "dialog[open]",
  '[role="dialog"][aria-modal="true"]',
  ".react-dialog-backdrop",
  ".release-profile-card",
].join(",");

export function installModalScrollRestoration(
  win: Window,
  doc: Document,
): () => void {
  const runtime = win as Window & typeof globalThis;
  const active = new Map<Element, PagePosition>();
  const closeHandlers = new Map<Element, EventListener>();
  const nativeShowModal = runtime.HTMLDialogElement?.prototype.showModal;
  let lastPagePosition: PagePosition = {
    hash: win.location.hash,
    x: win.scrollX,
    y: win.scrollY,
  };

  const rememberPagePosition = () => {
    if (active.size) return;
    lastPagePosition = {
      hash: win.location.hash,
      x: win.scrollX,
      y: win.scrollY,
    };
  };

  const restore = (element: Element) => {
    const position = active.get(element);
    if (!position) return;
    active.delete(element);
    const closeHandler = closeHandlers.get(element);
    if (closeHandler) {
      element.removeEventListener("close", closeHandler);
      closeHandlers.delete(element);
    }
    if (active.size || position.hash !== win.location.hash) return;
    win.requestAnimationFrame(() => {
      win.requestAnimationFrame(() => {
        if (position.hash !== win.location.hash) return;
        win.scrollTo({ behavior: "auto", left: position.x, top: position.y });
        lastPagePosition = position;
      });
    });
  };

  const register = (element: Element, position = lastPagePosition) => {
    if (active.has(element)) return;
    active.set(element, {
      hash: position.hash,
      x: position.x,
      y: position.y,
    });
    if (element instanceof runtime.HTMLDialogElement) {
      const closeHandler: EventListener = () => restore(element);
      closeHandlers.set(element, closeHandler);
      element.addEventListener("close", closeHandler);
    }
  };

  const registerTree = (node: Node) => {
    if (!(node instanceof runtime.Element)) return;
    if (node.matches(MODAL_SELECTOR)) register(node);
    node.querySelectorAll(MODAL_SELECTOR).forEach((element) => register(element));
  };

  const restoreTree = (node: Node) => {
    if (!(node instanceof runtime.Element)) return;
    [...active.keys()].forEach((element) => {
      if (node === element || node.contains(element)) restore(element);
    });
  };

  const observer = new runtime.MutationObserver((records) => {
    records.forEach((record) => {
      if (record.type === "attributes") {
        const element = record.target as Element;
        element.matches(MODAL_SELECTOR)
          ? register(element)
          : restore(element);
        return;
      }
      record.removedNodes.forEach(restoreTree);
      record.addedNodes.forEach(registerTree);
    });
  });

  observer.observe(doc.documentElement, {
    attributeFilter: ["open", "aria-modal"],
    attributes: true,
    childList: true,
    subtree: true,
  });
  win.addEventListener("scroll", rememberPagePosition, { passive: true });
  doc.querySelectorAll(MODAL_SELECTOR).forEach((element) => register(element));

  if (nativeShowModal) {
    runtime.HTMLDialogElement.prototype.showModal = function showModalWithPosition() {
      rememberPagePosition();
      register(this, lastPagePosition);
      return nativeShowModal.call(this);
    };
  }

  return () => {
    observer.disconnect();
    win.removeEventListener("scroll", rememberPagePosition);
    closeHandlers.forEach((handler, element) =>
      element.removeEventListener("close", handler),
    );
    if (nativeShowModal) runtime.HTMLDialogElement.prototype.showModal = nativeShowModal;
  };
}

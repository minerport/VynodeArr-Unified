const css = `
.overlay-editor.overlay-editor {
  width: min(1760px, calc(100vw - 24px));
}

.overlay-editor .overlay-editor-grid {
  grid-template-columns: minmax(230px, 250px) minmax(370px, 1fr) minmax(400px, 1.08fr) minmax(340px, 380px);
  grid-template-areas: "rail fields conditions preview";
  gap: 16px;
  align-items: stretch;
  min-height: 0;
  overflow: hidden;
}

.overlay-editor .overlay-editor-rail,
.overlay-editor .overlay-editor-fields,
.overlay-editor .overlay-editor-grid > .overlay-condition-row {
  box-sizing: border-box;
  min-width: 0;
  max-height: calc(100dvh - 190px);
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
  padding-right: 8px;
}

.overlay-editor .overlay-editor-grid > .overlay-condition-row {
  grid-area: conditions;
  grid-column: auto;
  grid-row: auto;
  position: static;
}

.overlay-editor .overlay-preview-column {
  grid-area: preview;
  align-self: start;
  position: sticky;
  top: 0;
}

.overlay-editor .overlay-preview-column .overlay-preview {
  width: min(100%, 300px);
}

.overlay-editor .overlay-condition-rule,
.overlay-editor .overlay-style-overrides {
  grid-template-columns: 1fr;
}

.overlay-editor .overlay-style-variants > header {
  align-items: stretch;
  flex-direction: column;
}

@media (max-width: 1499px) {
  .overlay-editor .overlay-editor-grid {
    grid-template-columns: 230px minmax(360px, 1fr) 340px;
    grid-template-areas:
      "rail fields preview"
      "conditions conditions preview";
  }

  .overlay-editor .overlay-editor-grid > .overlay-condition-row {
    max-height: 420px;
  }
}

@media (max-width: 1099px) {
  .overlay-editor .overlay-editor-grid {
    grid-template-columns: minmax(300px, 1fr) 320px;
    grid-template-areas:
      "rail preview"
      "fields preview"
      "conditions preview";
  }

  .overlay-editor .overlay-editor-rail,
  .overlay-editor .overlay-editor-fields,
  .overlay-editor .overlay-editor-grid > .overlay-condition-row {
    max-height: calc((100dvh - 220px) / 2);
  }
}

@media (max-width: 980px) {
  .overlay-editor.overlay-editor {
    width: min(760px, calc(100vw - 24px));
  }

  .overlay-editor .overlay-editor-grid {
    grid-template-columns: 1fr;
    grid-template-areas: "preview" "rail" "fields" "conditions";
    align-items: start;
    overflow-y: auto;
  }

  .overlay-editor .overlay-editor-rail,
  .overlay-editor .overlay-editor-fields,
  .overlay-editor .overlay-editor-grid > .overlay-condition-row {
    max-height: none;
    overflow: visible;
    padding-right: 0;
  }

  .overlay-editor .overlay-preview-column {
    position: static;
  }

  .overlay-editor .overlay-preview-column .overlay-preview {
    width: min(100%, 220px);
  }
}
`;

const refinements = `
.overlay-editor .overlay-layer-body > .notice {
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 6px 10px;
  align-items: baseline;
  padding: 10px 12px;
}

.overlay-editor .overlay-layer-body > .notice strong,
.overlay-editor .overlay-layer-body > .notice small {
  display: block;
  min-width: 0;
  line-height: 1.4;
}

.overlay-editor .overlay-editor-fields,
.overlay-editor .overlay-condition-workspace,
.overlay-editor .overlay-condition-builder,
.overlay-editor .overlay-style-variants {
  align-content: start;
}

.overlay-editor .overlay-editor-fields > .overlay-layer-editor {
  align-self: start;
  height: max-content;
  min-height: max-content;
}

.overlay-editor .overlay-style-variants > header {
  position: static;
  display: grid;
  height: auto;
  padding: 0 0 12px;
  border-bottom: 1px solid var(--border);
  background: transparent;
  text-align: left;
}

.overlay-editor .overlay-style-variants > header h3,
.overlay-editor .overlay-style-variants > p {
  margin: 0;
  line-height: 1.5;
}

.overlay-editor .overlay-style-variants > header small {
  display: block;
  margin-top: 5px;
  line-height: 1.45;
}

.overlay-editor .overlay-style-variants > header button {
  width: 100%;
  margin-top: 2px;
}

@media (min-width: 1500px) {
  .overlay-editor .overlay-editor-grid {
    box-sizing: border-box;
    height: 100%;
    max-height: 100%;
  }

  .overlay-editor .overlay-editor-rail,
  .overlay-editor .overlay-editor-fields,
  .overlay-editor .overlay-editor-grid > .overlay-condition-row {
    align-self: stretch;
    height: 100% !important;
    min-height: 0 !important;
    max-height: 100% !important;
    overflow-y: auto !important;
    touch-action: pan-y;
    padding-bottom: 48px;
  }

  .overlay-editor .overlay-editor-fields {
    scrollbar-color: var(--accent) color-mix(in srgb, var(--panel) 80%, #000);
    scrollbar-width: auto;
  }
}
`;

const sizingFix = `
@media (min-width: 981px) {
  .overlay-editor {
    height: calc(100dvh - 40px);
    grid-template-rows: auto minmax(0, 1fr) auto;
  }

  .overlay-editor .overlay-editor-grid {
    height: 100%;
    max-height: 100%;
  }
}
`;

const id = "poster-overlay-editor-layout";
if (typeof document !== "undefined" && !document.getElementById(id)) {
  const style = document.createElement("style");
  style.id = id;
  style.textContent = css + refinements + sizingFix;
  document.head.append(style);
}

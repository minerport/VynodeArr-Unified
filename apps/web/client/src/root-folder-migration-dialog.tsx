import { ModalPortal } from "./modal-portal";
import type { PathMigrationPreview, RootFolder, StorageDomain } from "./root-folders-types";

export interface MigrationDialogProps {
  busy: boolean;
  domain: StorageDomain;
  migration: { root: RootFolder; preview: PathMigrationPreview };
  onClose: () => void;
  onIgnore: (root: RootFolder) => void;
  onMigrate: () => void;
}

export default function RootFolderMigrationDialog({ busy, domain, migration, onClose, onIgnore, onMigrate }: MigrationDialogProps) {
  const match = migration.preview.match;
  if (!match) return null;
  return (
    <ModalPortal>
      <div className="root-folder-browser-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
        <section className="panel root-folder-browser" role="dialog" aria-modal="true" aria-label="Existing library path detected">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">SAME UNRAID FOLDER DETECTED</span>
              <h2>Update existing locations?</h2>
              <p className="muted">The new path points to the same physical folder as an existing engine root.</p>
            </div>
            <button className="secondary" disabled={busy} onClick={onClose}>Close</button>
          </div>
          <div className="notice storage-warning">
            <strong>These are two paths to the same files</strong>
            <p><code>{match.sourceRoot}</code> and <code>{match.targetRoot}</code> resolve to the same Unraid folder. Scanning could make the existing library look duplicated.</p>
          </div>
          <div className="migration-summary">
            <div><strong>{match.affected.length}</strong><small>existing {domain === "movie" ? "movies" : "series"} use the old path</small></div>
            <p>VynodeArr can update their stored location to the new path without copying, renaming, moving, or deleting files. Keep both container mappings until this finishes.</p>
          </div>
          <details>
            <summary>Preview path changes</summary>
            <div className="available-mapping-list">
              {match.affected.slice(0, 100).map((item) => <article className="storage-path-row" key={item.id}><div className="storage-path-copy"><strong>{item.title}</strong><small>{item.oldPath}</small><small>→ {item.newPath}</small></div></article>)}
            </div>
            {match.affected.length > 100 ? <p className="muted">And {match.affected.length - 100} more.</p> : null}
          </details>
          <div className="form-actions">
            <button className="secondary" disabled={busy} onClick={() => onIgnore(migration.root)}>Ignore and scan anyway</button>
            <button className="primary" disabled={busy} onClick={onMigrate}>{busy ? "Updating locations…" : `Update ${match.affected.length} existing locations`}</button>
          </div>
        </section>
      </div>
    </ModalPortal>
  );
}

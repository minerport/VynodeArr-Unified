import { useEffect, useState } from "react";
import { ModalPortal } from "./modal-portal";
import type { PathMigrationPreview, RootFolder, StorageDomain } from "./root-folders-types";

export interface MigrationDialogProps {
  busy: boolean;
  domain: StorageDomain;
  migration: { root: RootFolder; preview: PathMigrationPreview };
  progress: { completed: number; total: number; startedAt: number } | null;
  onClose: () => void;
  onIgnore: (root: RootFolder) => void;
  onMigrate: () => void;
}

const duration = (seconds: number) => seconds < 60 ? `${Math.max(1, Math.ceil(seconds))} sec` : `${Math.floor(seconds / 60)} min ${Math.ceil(seconds % 60)} sec`;

export default function RootFolderMigrationDialog({ busy, domain, migration, progress, onClose, onIgnore, onMigrate }: MigrationDialogProps) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!progress) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [progress?.startedAt]);
  const match = migration.preview.match;
  if (!match) return null;
  const elapsed = progress ? Math.max(1, (now - progress.startedAt) / 1000) : 0,
    rate = progress?.completed ? progress.completed / elapsed : 0,
    remaining = progress && rate ? (progress.total - progress.completed) / rate : 0,
    percent = progress?.total ? Math.round(progress.completed / progress.total * 100) : 0;
  return (
    <ModalPortal>
      <div className="root-folder-browser-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
        <section className="panel root-folder-browser" role="dialog" aria-modal="true" aria-label="Existing library path detected">
          <div className="panel-heading">
            <div><span className="eyebrow">SAME UNRAID FOLDER DETECTED</span><h2>Update existing locations?</h2><p className="muted">The new path points to the same physical folder as an existing engine root.</p></div>
            <button className="secondary" disabled={busy} onClick={onClose}>Close</button>
          </div>
          <div className="notice storage-warning"><strong>These are two paths to the same files</strong><p><code>{match.sourceRoot}</code> and <code>{match.targetRoot}</code> resolve to the same Unraid folder. Scanning could make the existing library look duplicated.</p></div>
          <div className="migration-summary"><div><strong>{match.affected.length}</strong><small>existing {domain === "movie" ? "movies" : "series"} use the old path</small></div><p>VynodeArr can update their stored location to the new path without copying, renaming, moving, or deleting files. Keep both container mappings until this finishes.</p></div>
          <details>
            <summary>Preview path changes</summary>
            <div className="available-mapping-list">{match.affected.slice(0, 100).map((item) => <article className="storage-path-row" key={item.id}><div className="storage-path-copy"><strong>{item.title}</strong><small>{item.oldPath}</small><small>→ {item.newPath}</small></div></article>)}</div>
            {match.affected.length > 100 ? <p className="muted">And {match.affected.length - 100} more.</p> : null}
          </details>
          {progress ? <div className="notice" role="status" aria-live="polite">
            <strong>Updated {progress.completed.toLocaleString()} of {progress.total.toLocaleString()} locations ({percent}%)</strong>
            <progress max={Math.max(1, progress.total)} value={progress.completed} />
            <p>{progress.completed ? `About ${duration(remaining)} remaining` : "Estimating time remaining…"} · {duration(elapsed)} elapsed</p>
          </div> : null}
          <div className="form-actions">
            <button className="secondary" disabled={busy} onClick={() => onIgnore(migration.root)}>Ignore and scan anyway</button>
            <button className="primary" disabled={busy} onClick={onMigrate}>{busy ? `Updating ${progress?.completed || 0} of ${progress?.total || match.affected.length}…` : `Update ${match.affected.length} existing locations`}</button>
          </div>
        </section>
      </div>
    </ModalPortal>
  );
}

import { useEffect, useState } from "react";
import type { AvailableLibraryFolder, RootFoldersMountOptions, StorageDomain } from "./root-folders-types";

interface Props {
  busy: string;
  parentPath: string;
  options: RootFoldersMountOptions;
  onRegister: (path: string, domain: StorageDomain) => Promise<void>;
}

function FolderLevel({ busy, parentPath, options, onRegister }: Props) {
  const [folders, setFolders] = useState<AvailableLibraryFolder[]>([]), [loading, setLoading] = useState(true), [error, setError] = useState(""), [expanded, setExpanded] = useState("");
  useEffect(() => {
    setLoading(true); setError("");
    void options.request<{ folders: AvailableLibraryFolder[] }>(`/api/storage/library-folder-children?path=${encodeURIComponent(parentPath)}`)
      .then((value) => setFolders(value.folders || []))
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Subfolders are unavailable."))
      .finally(() => setLoading(false));
  }, [options, parentPath]);
  if (loading) return <div className="empty compact"><p>Loading the next folder level…</p></div>;
  if (error) return <div className="empty compact error-state"><p>{error}</p></div>;
  if (!folders.length) return <div className="empty compact"><p>No subfolders were found inside {parentPath}.</p></div>;
  return <div className="media-folder-children">{folders.map((item) => {
    const assigned = item.registeredMovie ? "Movies" : item.registeredTv ? "Television" : null, open = expanded === item.path;
    return <div className="media-folder-tree-node" key={item.path}>
      <article className="storage-path-row"><span className={`storage-path-state ${assigned ? "available" : "pending"}`} /><div className="storage-path-copy"><strong>{item.label}</strong><small>{item.path}</small><small>{assigned ? `Assigned to ${assigned}.` : "Choose this folder, or open it to browse one level deeper."}</small></div><div className="storage-path-actions"><button className="secondary" disabled={Boolean(busy)} onClick={() => setExpanded(open ? "" : item.path)}>{open ? "Hide subfolders" : "Show subfolders"}</button>{!assigned ? <div className="button-row"><button className="secondary" disabled={Boolean(busy)} onClick={() => void onRegister(item.path, "movie")}>Use for Movies</button><button className="secondary" disabled={Boolean(busy)} onClick={() => void onRegister(item.path, "tv")}>Use for Television</button></div> : null}</div></article>
      {open ? <FolderLevel busy={busy} parentPath={item.path} options={options} onRegister={onRegister} /> : null}
    </div>;
  })}</div>;
}

export default FolderLevel;

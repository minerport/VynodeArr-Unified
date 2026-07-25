import './react-rename-preview.css';

export interface RenameFilePreview {id?:number;existingPath?:string;newPath?:string}
export interface RenamePreviewRecord {previewId?:string;expiresAt?:string;domain:'movie'|'tv';mediaId:number;title?:string;currentPath?:string;destinationPath?:string;rootFolderPath?:string;folderChange?:boolean;files?:RenameFilePreview[]}
export interface RenamePreviewProps {preview:RenamePreviewRecord;busy?:boolean;onClose:()=>void;onApply:()=>Promise<unknown>|unknown}
const path=(value?:string)=>String(value||'Not reported').replaceAll('\\','/');
const filename=(value?:string)=>path(value).split('/').filter(Boolean).at(-1)||'Unknown file';

export function RenamePreview({preview,busy=false,onClose,onApply}:RenamePreviewProps){
  const files=preview.files||[],fileChanges=files.filter(file=>path(file.existingPath)!==path(file.newPath)),changeCount=fileChanges.length+Number(Boolean(preview.folderChange));
  return <dialog open className="vynode-rename-dialog" aria-label={`Rename preview for ${preview.title||'media'}`}>
    <div className="rename-preview-heading"><div><span className="eyebrow">RENAME PREVIEW</span><h2>{preview.title||'Media organization'}</h2><p>{changeCount?`${changeCount} proposed ${changeCount===1?'change':'changes'}`:'Everything already matches the naming configuration'}</p></div><button className="secondary" disabled={busy} onClick={onClose}>Close</button></div>
    <section className={`rename-folder-preview ${preview.folderChange?'changed':'unchanged'}`}><div><span>Current library folder</span><strong>{path(preview.currentPath)}</strong></div><i aria-hidden="true">→</i><div><span>{preview.folderChange?'Proposed library folder':'Library folder'}</span><strong>{path(preview.destinationPath)}</strong></div></section>
    <div className="rename-preview-summary"><span className={`badge ${changeCount?'amber':'green'}`}>{changeCount?`${changeCount} changes`:'Already organized'}</span><p>VynodeArr uses the naming rules configured in the {preview.domain==='movie'?'movie':'television'} engine. Files are moved within the configured library.</p></div>
    <section className="rename-file-section"><div className="panel-heading"><div><span className="eyebrow">FILES</span><h3>{fileChanges.length?`${fileChanges.length} files will be renamed`:'No file renames required'}</h3></div><span>{files.length} evaluated</span></div>
      {fileChanges.length?<div className="rename-file-list">{fileChanges.map((file,index)=><article key={`${file.id??index}:${file.existingPath}`}><div><small>Current</small><strong>{filename(file.existingPath)}</strong><code>{path(file.existingPath)}</code></div><i aria-hidden="true">→</i><div><small>New name</small><strong>{filename(file.newPath)}</strong><code>{path(file.newPath)}</code></div></article>)}</div>:<div className="empty compact"><p>The current file names already match the configured format.</p></div>}
    </section>
    <footer className="rename-preview-actions"><button className="secondary" disabled={busy} onClick={onClose}>Cancel</button><button className="primary" disabled={busy||!changeCount} onClick={()=>void onApply()}>{busy?'Applying changes…':changeCount?'Apply rename & move':'No changes needed'}</button></footer>
  </dialog>;
}

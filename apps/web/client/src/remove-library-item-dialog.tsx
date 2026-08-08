import { useState,type FormEvent } from 'react';
import './remove-library-item-dialog.css';

export function RemoveLibraryItemDialog({title,kind,busy,onClose,onRemove}:{title:string;kind:'movie'|'series';busy:boolean;onClose:()=>void;onRemove:(deleteFiles:boolean)=>Promise<void>}){
  const [deleteFiles,setDeleteFiles]=useState(false);
  const submit=async(event:FormEvent<HTMLFormElement>)=>{
    event.preventDefault();
    if(deleteFiles&&!window.confirm(`Permanently delete every media file and the ${title} folder from the root folder? This cannot be undone.`))return;
    await onRemove(deleteFiles);
  };
  return <dialog open className="remove-library-item-dialog">
    <form onSubmit={event=>void submit(event)}>
      <div className="panel-heading"><div><span className="eyebrow">REMOVE FROM LIBRARY</span><h2>{title}</h2><p>Choose whether the files on disk should be kept.</p></div><button type="button" className="secondary" disabled={busy} onClick={onClose}>Close</button></div>
      <label className={`remove-files-choice${deleteFiles?' selected':''}`}>
        <input type="checkbox" checked={deleteFiles} onChange={event=>setDeleteFiles(event.target.checked)}/>
        <span><strong>Delete media files and {kind} folder</strong><small>Also permanently remove the files and title folder from the configured root folder.</small></span>
      </label>
      <p className={deleteFiles?'remove-files-warning':'remove-files-safe'}>{deleteFiles?'Permanent deletion is enabled. You will receive one final warning.':'Files and the title folder will be kept.'}</p>
      <div className="form-actions"><button type="button" className="secondary" disabled={busy} onClick={onClose}>Cancel</button><button className="danger" disabled={busy}>{busy?'Removing…':deleteFiles?'Remove and delete files':'Remove and keep files'}</button></div>
    </form>
  </dialog>;
}

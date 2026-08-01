import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import type {DiscoverItem,DiscoverMountOptions,LibraryItem} from './discover-types';

interface DiscoverDetailProps{
  item:DiscoverItem;
  libraryItem?:LibraryItem;
  options:DiscoverMountOptions;
  onClose:()=>void;
  onRequest:(item:DiscoverItem)=>void;
}

export function DiscoverDetail({item,libraryItem,options,onClose,onRequest}:DiscoverDetailProps){
  const dialog=useRef<HTMLDialogElement>(null);
  const [detail,setDetail]=useState(item);
  const [loading,setLoading]=useState(true);
  const [collectionState,setCollectionState]=useState<{included:boolean;canRemove:boolean}>({included:false,canRemove:false}),[savingCollection,setSavingCollection]=useState(false);

  useEffect(()=>{
    dialog.current?.showModal();
    let active=true;
    void options.request<{item:DiscoverItem}>(`/api/discover/details/${item.domain}/${item.tmdbId}`)
      .then(value=>{if(active&&value.item)setDetail(current=>({...current,...value.item}));})
      .catch(()=>{})
      .finally(()=>{if(active)setLoading(false);});
    if(libraryItem)void options.request<{included:boolean;canRemove:boolean}>(`/api/user-collections/contains?domain=${item.domain}&mediaId=${libraryItem.id}`).then(value=>{if(active)setCollectionState(value);}).catch(()=>{});
    return()=>{active=false;};
  },[item,options]);

  const close=()=>dialog.current?.close();
  const changeCollection=async()=>{if(!libraryItem||savingCollection||collectionState.included&&!collectionState.canRemove)return;setSavingCollection(true);try{if(collectionState.canRemove){await options.request(`/api/user-collections/items/${item.domain}/${libraryItem.id}`,{method:'DELETE'});setCollectionState({included:false,canRemove:false});options.notify(`${detail.title} was removed from your collection.`);}else{await options.request('/api/user-collections/items',{method:'POST',body:JSON.stringify({domain:item.domain,mediaId:libraryItem.id,tmdbId:libraryItem.tmdbId||detail.tmdbId,tvdbId:libraryItem.tvdbId||detail.tvdbId,title:libraryItem.title||detail.title,year:libraryItem.year||detail.year})});setCollectionState({included:true,canRemove:true});options.notify(`${detail.title} was added to your collection.`);}}catch(error){options.notify(error instanceof Error?error.message:'Your collection could not be updated.','error');}finally{setSavingCollection(false);}};
  const inLibrary=Boolean(libraryItem);
  const poster=detail.poster||libraryItem?.artwork?.url;
  const backdrop=detail.backdrop||libraryItem?.backdrop?.url;
  const genres=detail.genres?.length?detail.genres:[detail.genre||'Uncategorized'];
  const context=detail.domain==='movie'?detail.studio:detail.network;
  const facts=[
    ['Type',detail.domain==='movie'?'Movie':'TV series'],
    ['Release year',detail.year||'TBA'],
    ['Rating',detail.rating?`${detail.rating.toFixed(1)} / 10`:'Not rated'],
    [detail.domain==='movie'?'Studio':'Network',context||'Not specified'],
    ['Runtime',detail.runtime?`${detail.runtime} min`:'Not reported'],
    ['Status',detail.status||'Announced'],
  ];

  return createPortal(<dialog ref={dialog} className="discover-detail-dialog" onClose={onClose} onCancel={event=>{event.preventDefault();close();}}>
    {backdrop?<div className="discover-detail-backdrop"><img src={backdrop} alt=""/></div>:null}
    <button className="discover-detail-close" type="button" aria-label="Close details" onClick={close}>×</button>
    <div className="discover-detail-content">
      <div className="discover-detail-poster">{poster?<img src={poster} alt={`${detail.title} poster`}/>:<span>{detail.title.slice(0,1)}</span>}</div>
      <div className="discover-detail-copy">
        <span className="eyebrow">{detail.domain==='movie'?'MOVIE':'TV SERIES'}{inLibrary?' · IN LIBRARY':''}</span>
        <h2>{detail.title}</h2>
        <div className="discover-meta">{detail.rating?<span>★ {detail.rating.toFixed(1)}</span>:null}<span>{detail.year||'TBA'}</span>{detail.certification?<span>{detail.certification}</span>:null}</div>
        <p className="discover-detail-overview">{loading?'Loading title details…':detail.overview||'No overview is available for this title.'}</p>
        <div className="discover-detail-genres">{genres.map(value=><span className="badge" key={value}>{value}</span>)}</div>
        <div className="discover-detail-facts">{facts.map(([label,value])=><div key={label}><small>{label}</small><strong>{value}</strong></div>)}</div>
        <div className="form-actions">
          {inLibrary&&libraryItem?.canView!==false?<button className="primary discover-view-library" type="button" onClick={()=>{close();location.hash=`#${detail.domain==='movie'?'movie':'series'}/${libraryItem?.id}`;}}>View in library</button>
            :inLibrary?<span className="badge green">Already in library</span>
            :<button className="primary discover-request-title" type="button" onClick={()=>{onRequest(detail);close();}}>Request {detail.domain==='movie'?'movie':'series'}</button>}
          {inLibrary?<button className="secondary discover-save-collection" type="button" disabled={savingCollection||collectionState.included&&!collectionState.canRemove} onClick={()=>void changeCollection()}>{savingCollection?'Updating…':collectionState.canRemove?'Remove from my collection':collectionState.included?'In my collection':'Add to my collection'}</button>:null}
          <button className="secondary discover-detail-cancel" type="button" onClick={close}>Close</button>
        </div>
      </div>
    </div>
  </dialog>,document.body);
}

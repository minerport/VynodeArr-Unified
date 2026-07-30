import {useCallback,useEffect,useRef,useState} from 'react';
import type {NotificationItem,NotificationMountOptions} from './notification-types';

const relativeTime=(value:string)=>{
  const seconds=Math.max(0,Math.floor((Date.now()-new Date(value).getTime())/1000));
  if(seconds<60)return'Just now';
  if(seconds<3600)return`${Math.floor(seconds/60)}m ago`;
  if(seconds<86400)return`${Math.floor(seconds/3600)}h ago`;
  return`${Math.floor(seconds/86400)}d ago`;
};

export function Notifications({options}:{options:NotificationMountOptions}){
  const [items,setItems]=useState<NotificationItem[]>([]),[unread,setUnread]=useState(0),[open,setOpen]=useState(false),[error,setError]=useState('');
  const host=useRef<HTMLDivElement>(null);
  const load=useCallback(async()=>{
    if(!options.canPoll())return;
    try{const value=await options.request<{items:NotificationItem[];unread:number;pageBadge:{href:'#request-management'|'#requests';count:number}}>('/api/notifications');setItems(value.items||[]);setUnread(Number(value.unread||0));options.onPageBadge(value.pageBadge);setError('');}
    catch{setError('Notifications are temporarily unavailable.');}
  },[options]);
  const mark=useCallback(async(ids?:string[])=>{
    try{await options.request('/api/notifications/read',{method:'POST',body:JSON.stringify(ids?{ids}:{})});setItems(current=>current.map(item=>!ids||ids.includes(item.id)?{...item,read:true}:item));setUnread(current=>{const next=ids?Math.max(0,current-ids.filter(id=>items.some(item=>item.id===id&&!item.read)).length):0;const href=items.some(item=>item.href==='#request-management')?'#request-management':'#requests';if(href==='#requests')options.onPageBadge({href,count:next});return next;});}
    catch{setError('Notifications could not be marked as read.');}
  },[items,options]);
  useEffect(()=>{void load();const timer=window.setInterval(()=>void load(),15_000);return()=>window.clearInterval(timer);},[load]);
  useEffect(()=>{const close=(event:MouseEvent)=>{if(open&&!host.current?.contains(event.target as Node))setOpen(false);};document.addEventListener('mousedown',close);return()=>document.removeEventListener('mousedown',close);},[open]);
  return <div className="notification-center" ref={host}>
    <button className={`notification-bell${open?' active':''}`} type="button" aria-label={unread?`Notifications, ${unread} unread`:'Notifications'} aria-expanded={open} onClick={()=>setOpen(current=>!current)}>
      <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg>{unread?<strong>{unread>99?'99+':unread}</strong>:null}
    </button>
    {open?<section className="notification-panel" aria-label="Notifications">
      <header><div><span className="eyebrow">ACTIVITY</span><h2>Notifications</h2></div>{unread?<button type="button" className="text-button" onClick={()=>void mark()}>Mark all read</button>:null}</header>
      {error?<p className="notification-error">{error}</p>:null}
      {!items.length&&!error?<div className="notification-empty"><strong>All caught up</strong><span>Request updates will appear here.</span></div>:<div className="notification-list">{items.map(item=><a className={`notification-item ${item.type}${item.read?' read':''}`} href={item.href} key={item.id} onClick={()=>{if(!item.read)void mark([item.id]);setOpen(false);}}><i aria-hidden="true"/><div><strong>{item.title}</strong><p>{item.message}</p><small>{relativeTime(item.timestamp)}</small></div></a>)}</div>}
    </section>:null}
  </div>;
}

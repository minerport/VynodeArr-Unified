import { useMemo,useState } from 'react';
import './react-release-browser.css';

export type ReleaseRecord=Record<string,unknown>&{
  title?:string;indexer?:string;protocol?:string;size?:number;seeders?:number;leechers?:number;
  age?:number;ageHours?:number;publishDate?:string;customFormatScore?:number;rejections?:string[];
  rejected?:boolean;approved?:boolean;downloadAllowed?:boolean;
  quality?:{quality?:{name?:string};name?:string};
  languages?:Array<{name?:string}|string>;
};
type SortKey='title'|'source'|'quality'|'score'|'size'|'age'|'seeders'|'status';
export interface ReleaseBrowserProps {title:string;items:ReleaseRecord[];busy?:boolean;onClose:()=>void;onGrab:(release:ReleaseRecord)=>Promise<unknown>|unknown}
const text=(value:unknown,fallback:unknown='—')=>String(value===undefined||value===null||value===''?fallback:value);
const source=(release:ReleaseRecord)=>text(release.indexer||release.protocol,'Unknown source');
const quality=(release:ReleaseRecord)=>text(release.quality?.quality?.name||release.quality?.name,'Unknown');
const reasons=(release:ReleaseRecord)=>Array.isArray(release.rejections)?release.rejections.filter(Boolean):[];
const accepted=(release:ReleaseRecord)=>!release.rejected&&release.approved!==false&&release.downloadAllowed!==false&&!reasons(release).length;
const formatSize=(value:unknown)=>{const bytes=Number(value||0);return bytes?`${(bytes/1073741824).toFixed(bytes>=10737418240?1:2)} GB`:'—';};
const formatAge=(release:ReleaseRecord)=>{if(Number.isFinite(Number(release.ageHours)))return `${Math.round(Number(release.ageHours))}h`;if(Number.isFinite(Number(release.age)))return `${Math.round(Number(release.age))}d`;if(release.publishDate){const hours=Math.max(0,(Date.now()-new Date(release.publishDate).getTime())/3600000);return hours<48?`${Math.round(hours)}h`:`${Math.round(hours/24)}d`;}return '—';};
const language=(release:ReleaseRecord)=>(release.languages||[]).map(value=>typeof value==='string'?value:value.name).filter(Boolean).join(', ')||'Unknown';
const value=(release:ReleaseRecord,key:SortKey):string|number=>key==='title'?text(release.title,''):key==='source'?source(release):key==='quality'?quality(release):key==='score'?Number(release.customFormatScore||0):key==='size'?Number(release.size||0):key==='age'?Number(release.ageHours??Number(release.age||0)*24):key==='seeders'?Number(release.seeders??-1):accepted(release)?0:1;

export function ReleaseBrowser({title,items,busy=false,onClose,onGrab}:ReleaseBrowserProps){
  const [sortKey,setSortKey]=useState<SortKey>('status'),[direction,setDirection]=useState(1),[showRejected,setShowRejected]=useState(true),[grabbing,setGrabbing]=useState<number|null>(null);
  const visible=useMemo(()=>items.map((release,index)=>({release,index})).filter(({release})=>showRejected||accepted(release)).sort((left,right)=>{const a=value(left.release,sortKey),b=value(right.release,sortKey);return direction*(typeof a==='number'&&typeof b==='number'?a-b:String(a).localeCompare(String(b),undefined,{numeric:true,sensitivity:'base'}));}),[items,showRejected,sortKey,direction]);
  const acceptedCount=items.filter(accepted).length,rejectedCount=items.length-acceptedCount;
  const sort=(next:SortKey)=>{if(next===sortKey)setDirection(current=>current*-1);else{setSortKey(next);setDirection(1);}};
  const grab=async(release:ReleaseRecord,index:number)=>{setGrabbing(index);try{await onGrab(release);}finally{setGrabbing(null);}};
  const heading=(key:SortKey,label:string)=><button className={sortKey===key?'active':''} onClick={()=>sort(key)}>{label}{sortKey===key?(direction>0?' ↑':' ↓'):''}</button>;
  return <dialog open className="vynode-release-dialog" aria-label={`Interactive search for ${title}`}><div className="release-browser-shell">
    <header className="release-browser-heading"><div><span className="eyebrow">INTERACTIVE SEARCH</span><h2>{title}</h2><p>{acceptedCount} accepted · {rejectedCount} rejected · {items.length} total</p></div><button className="secondary" onClick={onClose}>Close</button></header>
    <div className="release-browser-toolbar"><label className="check"><input type="checkbox" checked={showRejected} onChange={event=>setShowRejected(event.target.checked)}/> Show rejected releases</label><span>Searches may be reused for 45 seconds. Every grab is checked live by the engine.</span></div>
    {!visible.length?<div className="empty compact"><h2>No matching releases</h2><p>{items.length?'Rejected releases are hidden.':'No enabled indexer returned a release for this search.'}</p></div>:<div className="native-release-table"><div className="native-release-header">{heading('title','Release')}{heading('source','Source')}{heading('quality','Quality')}{heading('score','Score')}{heading('size','Size')}{heading('age','Age')}{heading('seeders','Peers')}{heading('status','Status')}<span>Action</span></div><div className="native-release-results">{visible.map(({release,index})=>{const rejectionReasons=reasons(release),isAccepted=accepted(release);return <article className={`native-release-row ${isAccepted?'accepted':'rejected'}`} key={`${text(release.guid,index)}:${index}`}>
      <div className="native-release-title"><strong title={text(release.title)}>{text(release.title,'Unknown release')}</strong><small>{text(release.protocol,'Unknown protocol')} · {language(release)}</small>{rejectionReasons.length?<details><summary>{rejectionReasons.length} rejection {rejectionReasons.length===1?'reason':'reasons'}</summary><ul>{rejectionReasons.map((reason,reasonIndex)=><li key={`${reason}:${reasonIndex}`}>{reason}</li>)}</ul></details>:null}</div>
      <span data-label="Source">{source(release)}</span><span data-label="Quality">{quality(release)}</span><span data-label="Score">{text(release.customFormatScore,0)}</span><span data-label="Size">{formatSize(release.size)}</span><span data-label="Age">{formatAge(release)}</span><span data-label="Peers">{release.seeders===undefined?'—':`${release.seeders} / ${release.leechers??0}`}</span><span data-label="Status" className={`release-status ${isAccepted?'accepted':'rejected'}`}>{isAccepted?'Accepted':'Rejected'}</span>
      <button className={isAccepted?'primary':'secondary'} disabled={busy||grabbing!==null} title={isAccepted?'Grab this release':'Review the rejection reasons before grabbing manually'} onClick={()=>void grab(release,index)}>{grabbing===index?'Grabbing…':isAccepted?'Grab':'Grab anyway'}</button>
    </article>;})}</div></div>}
  </div></dialog>;
}

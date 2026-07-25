import {useCallback,useEffect,useState} from 'react';
import type {MediaManagementDomain,MediaManagementMountOptions,MediaSettingField,MediaSettings} from './media-management-types';

const choices:Record<string,Array<[string|number,string]>>={
  colonReplacementFormat:[['delete','Delete'],['dash','Dash'],['spaceDash','Space + dash'],['spaceDashSpace','Space + dash + space'],['smart','Smart replacement']],
  multiEpisodeStyle:[[0,'Extend'],[1,'Duplicate'],[2,'Repeat'],[3,'Scene'],[4,'Range'],[5,'Prefixed range']],
  downloadPropersAndRepacks:[['doNotPrefer','Do not prefer'],['preferAndUpgrade','Prefer and upgrade'],['doNotUpgrade','Prefer, do not upgrade']],
  rescanAfterRefresh:[['always','Always'],['afterManual','After manual refresh'],['never','Never']],
  allowFingerprinting:[['never','Never'],['newFiles','New files only'],['allFiles','All files']],
  fileDate:[['none','Do not change'],['cinemas','Cinema release date'],['release','Release date'],['airDate','Air date']],
  episodeTitleRequired:[['always','Always'],['bulkSeasonReleases','Only for single-episode releases'],['never','Never']]
};
const help:Record<string,string>={
  renameMovies:'Rename movie files using the selected naming format.',renameEpisodes:'Rename episode files using the selected naming formats.',replaceIllegalCharacters:'Replace characters that are not valid for the destination file system.',createEmptyMovieFolders:'Create folders for monitored movies before files are available.',createEmptySeriesFolders:'Create folders for monitored series before files are available.',deleteEmptyFolders:'Remove empty media folders during disk scans.',copyUsingHardlinks:'Use hardlinks when the download and library share a file system.',importExtraFiles:'Import matching subtitle and companion files.',extraFileExtensions:'Comma-separated extra extensions to import.',enableMediaInfo:'Read technical media information from imported files.',skipFreeSpaceCheckWhenImporting:'Allow imports without checking destination free space.',minimumFreeSpaceWhenImporting:'Minimum destination free space in megabytes.',setPermissionsLinux:'Apply configured Unix permissions to imported files and folders.',chmodFolder:'Unix folder and file permission mode.',chownGroup:'Unix group applied to imported media.',recycleBin:'Folder used instead of permanently deleting files.',recycleBinCleanupDays:'Days to retain deleted files in the recycle folder.'
};
const label=(value:string)=>value.replace(/([a-z0-9])([A-Z])/g,'$1 $2').replace(/[_-]+/g,' ').replace(/\b\w/g,letter=>letter.toUpperCase());
const flatten=(value:MediaSettings,prefix=''):MediaSettingField[]=>Object.entries(value||{}).flatMap(([key,item])=>{
  if(key==='id')return[];
  const path=prefix?`${prefix}.${key}`:key;
  return item&&typeof item==='object'&&!Array.isArray(item)?flatten(item as MediaSettings,path):[{path,key,value:item}];
});
const setPath=(source:MediaSettings,path:string,value:unknown)=>{
  const next=structuredClone(source),parts=path.split('.');let target=next;
  for(const part of parts.slice(0,-1)){if(!target[part]||typeof target[part]!=='object')target[part]={};target=target[part] as MediaSettings;}
  target[parts.at(-1)!]=value;return next;
};
const errorText=(reason:unknown)=>reason instanceof Error?reason.message:'Media management settings are unavailable.';

function Setting({field,onChange}:{field:MediaSettingField;onChange:(value:unknown)=>void}){
  const description=help[field.key],options=field.key==='colonReplacementFormat'&&typeof field.value==='number'?[[0,'Delete'],[1,'Dash'],[2,'Space + dash'],[3,'Space + dash + space'],[4,'Smart replacement'],[5,'Custom replacement']] as Array<[number,string]>:choices[field.key];
  if(typeof field.value==='boolean')return <label className="config-switch"><span><strong>{label(field.key)}</strong>{description?<small>{description}</small>:null}</span><input type="checkbox" checked={field.value} onChange={event=>onChange(event.target.checked)}/></label>;
  if(options){const all=options.some(([value])=>String(value)===String(field.value))?options:[[String(field.value),label(String(field.value))],...options];return <label>{label(field.key)}{description?<small>{description}</small>:null}<select value={String(field.value)} onChange={event=>{const match=all.find(([value])=>String(value)===event.target.value);onChange(typeof field.value==='number'?Number(match?.[0]):match?.[0]);}}>{all.map(([value,text])=><option value={String(value)} key={String(value)}>{text}</option>)}</select></label>;}
  const serialized=Array.isArray(field.value)?field.value.join(', '):String(field.value??''),change=(raw:string)=>onChange(typeof field.value==='number'?Number(raw):Array.isArray(field.value)?raw.split(',').map(value=>value.trim()).filter(Boolean):raw);
  return <label>{label(field.key)}{description?<small>{description}</small>:null}{/Format$/.test(field.key)?<textarea rows={3} value={serialized} onChange={event=>change(event.target.value)}/>:<input type={typeof field.value==='number'?'number':'text'} value={serialized} onChange={event=>change(event.target.value)}/>}</label>;
}

export function MediaManagementView({options}:{options:MediaManagementMountOptions}){
  const [domain,setDomain]=useState<MediaManagementDomain>('movie'),[naming,setNaming]=useState<MediaSettings>({}),[management,setManagement]=useState<MediaSettings>({}),[loading,setLoading]=useState(true),[busy,setBusy]=useState(''),[error,setError]=useState('');
  const load=useCallback(async()=>{setLoading(true);setError('');try{const [nameValue,managementValue]=await Promise.all([options.request<{result:MediaSettings}>(`/api/manage/${domain}/naming`),options.request<{result:MediaSettings}>(`/api/manage/${domain}/mediaManagement`)]);setNaming(nameValue.result||{});setManagement(managementValue.result||{});}catch(reason){setError(errorText(reason));}finally{setLoading(false);}},[domain,options]);
  useEffect(()=>{void load();},[load]);
  const save=async(resource:'naming'|'mediaManagement',value:MediaSettings)=>{setBusy(resource);try{await options.request(`/api/manage/${domain}/${resource}`,{method:'PUT',body:JSON.stringify(value)});options.notify(`${domain==='movie'?'Movie':'Television'} media management saved.`);await load();}catch(reason){options.notify(errorText(reason),'error');}finally{setBusy('');}};
  const sections:Array<[string,'naming'|'mediaManagement',MediaSettings,string]>=[['Naming and folders','naming',naming,'File and folder naming formats, illegal-character handling, and library folder behavior.'],['Importing and file management','mediaManagement',management,'Import behavior, rescanning, free-space checks, recycling, media inspection, and permissions.']];
  return <div className="media-management-react-route"><div className="hero"><div><span className="eyebrow">SERVICE SETTINGS</span><h1>Media Management</h1><p className="lede">Control naming, folders, importing, file handling, permissions, and recycling for both libraries.</p></div></div>
    <nav className="settings-tabs"><a href="#service/root-folders">Root Folders</a><a className="active" href="#service/media-management">Media Management</a><a href="#service/profiles">Quality Profiles</a><a href="#service/custom-formats">Custom Formats</a><a href="#service/release-profiles">Release Profiles</a><a href="#service/indexers">Indexers</a><a href="#service/download-clients">Download Clients</a><a href="#service/discover">Discover</a><a href="#management">Advanced</a></nav>
    <div className="management-toolbar"><label>Library<select value={domain} onChange={event=>setDomain(event.target.value as MediaManagementDomain)}><option value="movie">Movies</option><option value="tv">Television</option></select></label></div>
    {loading?<div className="panel skeleton">Loading media management…</div>:error?<div className="panel error-state"><h2>Media management unavailable</h2><p>{error}</p><button className="secondary" onClick={()=>void load()}>Try again</button></div>:<div className="media-management-layout">{sections.map(([titleText,resource,value,description])=><form className="panel media-config-form" key={resource} onSubmit={event=>{event.preventDefault();void save(resource,value);}}><div className="panel-heading"><div><h2>{titleText}</h2><p className="muted">{description}</p></div><button className="primary" disabled={busy===resource}>{busy===resource?'Saving…':'Save'}</button></div><div className="media-config-grid">{flatten(value).map(field=><Setting key={field.path} field={field} onChange={next=>resource==='naming'?setNaming(current=>setPath(current,field.path,next)):setManagement(current=>setPath(current,field.path,next))}/>)}</div></form>)}</div>}
  </div>;
}

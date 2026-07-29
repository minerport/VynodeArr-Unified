export type ImportDomain='movie'|'tv';
export type ImportRecord=Record<string,unknown>&{path?:string;title?:string;year?:number};
export type ImportFolder=Record<string,unknown>&{path:string;name?:string};
export type ImportChoice=Record<string,unknown>&{title?:string;year?:number;tmdbId?:number;tvdbId?:number;imdbId?:string};
export interface DuplicateEntry{path:string;imported:boolean;source:ImportRecord|ImportFolder}
export interface DuplicateDetail{entries:DuplicateEntry[];newestPath:string|null;newestTime:number;timestamp:number}
export interface MatchClassification{
  unmatched:boolean;titleMismatch:boolean;yearMismatch:boolean;duplicate:ImportRecord|null;warning:string;
}

type Request=<T=unknown>(path:string,options?:RequestInit)=>Promise<T>;
type ConcurrentMap=<T,R>(items:T[],limit:number,worker:(item:T,index:number)=>Promise<R>)=>Promise<R[]>;

export function scanNameParts(value:unknown){
  const raw=String(value||'').replace(/\.[a-z0-9]{2,5}$/i,'');
  const yearMatch=raw.match(/(?:^|[\s._(\[])(19\d{2}|20\d{2})(?=$|[\s._)\]])/);
  const year=yearMatch?Number(yearMatch[1]):null;
  const title=raw.replace(/[._]+/g,' ').replace(/\s*[\[(]?(?:19\d{2}|20\d{2})[\])]?\s*$/,'').replace(/\s+/g,' ').trim();
  return{title,year};
}

export const comparableTitle=(value:unknown)=>String(value||'').toLowerCase().replace(/\b(?:19|20)\d{2}\b/g,'').replace(/[^a-z0-9]+/g,' ').trim();

export function scanDuplicateKey(value:unknown,year?:unknown){
  const parts=scanNameParts(value),normalized=comparableTitle(parts.title);
  return normalized?`${normalized}:${Number(year||parts.year||0)||''}`:'';
}

export function scanTimestamp(value:Record<string,unknown>|null|undefined){
  const raw=value?.lastModifiedUtc||value?.lastModified||value?.lastWriteTimeUtc||value?.lastWriteTime||value?.modifiedAt||value?.dateModified||value?.mtime||value?.date;
  const parsed=raw?new Date(String(raw)).getTime():0;
  return Number.isFinite(parsed)?parsed:0;
}

export const scanDate=(value:unknown)=>value?new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'short'}).format(new Date(String(value))):'Date unavailable';

export function findImportedMatch(choice:ImportChoice|undefined,records:ImportRecord[],movie:boolean){
  if(!choice)return null;
  const identityFields=movie?['tmdbId','imdbId']:['tvdbId','tmdbId','imdbId'];
  return records.find(record=>identityFields.some(field=>choice[field]&&record[field]&&String(choice[field])===String(record[field])))
    ||records.find(record=>comparableTitle(record.title)===comparableTitle(choice.title)&&(!record.year||!choice.year||Number(record.year)===Number(choice.year)))
    ||null;
}

export function classifyImportChoice(folder:ImportFolder,choice:ImportChoice|undefined,records:ImportRecord[],movie:boolean):MatchClassification{
  const parsed=scanNameParts(folder.name||folder.path),duplicate=findImportedMatch(choice,records,movie);
  const titleMismatch=Boolean(choice)&&comparableTitle(parsed.title)!==comparableTitle(choice?.title);
  const yearMismatch=Boolean(choice&&parsed.year&&choice.year)&&Number(parsed.year)!==Number(choice?.year);
  const unmatched=!choice;
  const warning=unmatched?'No match selected'
    :titleMismatch&&yearMismatch?`Title and year may not match (${parsed.year} vs ${choice?.year||'unknown'})`
    :titleMismatch?'Title may not match folder name'
    :yearMismatch?`Year may not match (${parsed.year} vs ${choice?.year})`:'';
  return{unmatched,titleMismatch,yearMismatch,duplicate,warning};
}

export async function analyzeDuplicateFolders({domain,folders,imported,request,mapConcurrent}:{domain:ImportDomain;folders:ImportFolder[];imported:ImportRecord[];request:Request;mapConcurrent:ConcurrentMap}){
  const groups=new Map<string,DuplicateEntry[]>();
  const add=(entry:DuplicateEntry,key:string)=>{if(key)groups.set(key,[...(groups.get(key)||[]),entry]);};
  folders.forEach(folder=>add({path:folder.path,imported:false,source:folder},scanDuplicateKey(folder.name||folder.path)));
  imported.forEach(record=>{if(record.path)add({path:record.path,imported:true,source:record},scanDuplicateKey(record.title||record.path,record.year));});
  const duplicateGroups=[...groups.values()].filter(entries=>entries.length>1);
  const paths=[...new Set(duplicateGroups.flatMap(entries=>entries.map(entry=>entry.path)).filter(Boolean))];
  const values=await mapConcurrent(paths,6,path=>request<{result?:Record<string,unknown>&{files?:Record<string,unknown>[];directories?:Record<string,unknown>[]}}>(`/api/manage/${domain}/filesystem?path=${encodeURIComponent(path)}&includeFiles=true&allowFoldersWithoutTrailingSlashes=true`).catch(()=>({result:undefined})));
  const allEntries=duplicateGroups.flat();
  const timestamps=new Map(paths.map((path,index)=>{
    const result=values[index]?.result,files=Array.isArray(result?.files)?result.files:[],directories=Array.isArray(result?.directories)?result.directories:[],source=allEntries.find(entry=>entry.path===path)?.source;
    return[path,Math.max(scanTimestamp(source),scanTimestamp(result),...files.map(scanTimestamp),...directories.map(scanTimestamp))] as const;
  }));
  const details=new Map<string,DuplicateDetail>();
  for(const entries of duplicateGroups){
    const ranked=[...entries].sort((left,right)=>(timestamps.get(right.path)||0)-(timestamps.get(left.path)||0));
    const newestTime=timestamps.get(ranked[0]?.path)||0,newestPath=newestTime?ranked[0].path:null;
    for(const entry of entries)details.set(entry.path,{entries,newestPath,newestTime,timestamp:timestamps.get(entry.path)||0});
  }
  return details;
}

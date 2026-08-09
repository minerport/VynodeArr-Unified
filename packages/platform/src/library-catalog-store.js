import { copyFile, mkdir, readFile, stat } from 'node:fs/promises';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const serialize=value=>JSON.stringify(value);
const parse=value=>{try{return JSON.parse(value);}catch{return null;}};
const now=()=>new Date().toISOString();
const publicId=(domain,id)=>String(id||'').startsWith(domain==='movie'?'movie_':'series_')?String(id):`${domain==='movie'?'movie':'series'}_${id}`;

export class LibraryCatalogStore {
  constructor(path,{legacyPath=null}={}){
    this.path=path;this.legacyPath=legacyPath;this.database=null;this.initialized=false;
  }
  async initialize(){
    if(this.initialized)return;
    await mkdir(dirname(this.path),{recursive:true});
    const existed=await stat(this.path).then(()=>true).catch(()=>false);
    if(existed)await copyFile(this.path,`${this.path}.pre-migration`).catch(()=>{});
    this.database=new DatabaseSync(this.path);
    this.database.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS schema_migrations(version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS library_items(
        domain TEXT NOT NULL CHECK(domain IN ('movie','tv')), id TEXT NOT NULL,
        title TEXT NOT NULL DEFAULT '', sort_title TEXT NOT NULL DEFAULT '', year INTEGER,
        monitoring TEXT, state TEXT, has_file INTEGER NOT NULL DEFAULT 0,
        missing_count INTEGER NOT NULL DEFAULT 0, cutoff_count INTEGER NOT NULL DEFAULT 0,
        source_updated_at TEXT, payload_hash TEXT NOT NULL, payload_json TEXT NOT NULL,
        updated_at TEXT NOT NULL, PRIMARY KEY(domain,id));
      CREATE INDEX IF NOT EXISTS library_items_title ON library_items(domain,sort_title,id);
      CREATE INDEX IF NOT EXISTS library_items_year ON library_items(domain,year,id);
      CREATE INDEX IF NOT EXISTS library_items_state ON library_items(domain,state,monitoring,id);
      CREATE INDEX IF NOT EXISTS library_items_updated ON library_items(domain,updated_at,id);
      CREATE TABLE IF NOT EXISTS catalog_state(key TEXT PRIMARY KEY,value_json TEXT NOT NULL,updated_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS event_queue(
        id INTEGER PRIMARY KEY AUTOINCREMENT,dedupe_key TEXT NOT NULL UNIQUE,domain TEXT NOT NULL,
        media_id TEXT,event_type TEXT NOT NULL,payload_json TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending',
        attempts INTEGER NOT NULL DEFAULT 0,available_at INTEGER NOT NULL,created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,last_error TEXT);
      CREATE INDEX IF NOT EXISTS event_queue_ready ON event_queue(status,available_at,id);
      CREATE TABLE IF NOT EXISTS artwork_index(
        cache_key TEXT PRIMARY KEY,file_name TEXT NOT NULL,content_type TEXT NOT NULL,size INTEGER NOT NULL,
        cached_at INTEGER NOT NULL,last_accessed_at INTEGER NOT NULL,source_revision TEXT);
      INSERT OR IGNORE INTO schema_migrations(version,applied_at) VALUES(1,datetime('now'));`);
    if(!existed)await this.importLegacy();
    this.initialized=true;
  }
  db(){if(!this.database)throw new Error('Library catalog is not initialized');return this.database;}
  async importLegacy(){
    if(!this.legacyPath)return;
    const legacy=await readFile(this.legacyPath,'utf8').then(parse).catch(()=>null);
    if(!legacy?.domains)return;
    for(const domain of ['movie','tv'])this.replaceDomainSync(domain,legacy.domains[domain]||[]);
    if(legacy.operations)this.setState('operations',legacy.operations);
    this.setState('legacyImport',{path:this.legacyPath,importedAt:now(),counts:{movie:(legacy.domains.movie||[]).length,tv:(legacy.domains.tv||[]).length}});
  }
  row(item,domain){
    const payload=serialize(item),missing=domain==='movie'?Number(item.state==='missing'):Number(item.missingEpisodes||0),cutoff=domain==='movie'?Number(item.state==='cutoff'):Number(item.cutoffUnmetEpisodes||0);
    return{domain,id:publicId(domain,item.id),title:String(item.title||''),sortTitle:String(item.sortTitle||item.title||'').toLocaleLowerCase(),year:Number(item.year)||null,monitoring:String(item.monitoring||''),state:String(item.state||''),hasFile:item.hasFile?1:0,missing,cutoff,sourceUpdatedAt:item.updatedAt||null,payloadHash:payload,payload,updatedAt:now()};
  }
  replaceDomainSync(domain,items){
    const db=this.db(),existing=new Map(db.prepare('SELECT id,payload_hash FROM library_items WHERE domain=?').all(domain).map(row=>[row.id,row.payload_hash])),next=new Set(),upsert=db.prepare(`INSERT INTO library_items(domain,id,title,sort_title,year,monitoring,state,has_file,missing_count,cutoff_count,source_updated_at,payload_hash,payload_json,updated_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(domain,id) DO UPDATE SET title=excluded.title,sort_title=excluded.sort_title,year=excluded.year,monitoring=excluded.monitoring,state=excluded.state,has_file=excluded.has_file,missing_count=excluded.missing_count,cutoff_count=excluded.cutoff_count,source_updated_at=excluded.source_updated_at,payload_hash=excluded.payload_hash,payload_json=excluded.payload_json,updated_at=excluded.updated_at`),remove=db.prepare('DELETE FROM library_items WHERE domain=? AND id=?');
    let updated=0,removed=0;db.exec('BEGIN IMMEDIATE');
    try{for(const item of items){const value=this.row(item,domain);next.add(value.id);if(existing.get(value.id)!==value.payloadHash){upsert.run(value.domain,value.id,value.title,value.sortTitle,value.year,value.monitoring,value.state,value.hasFile,value.missing,value.cutoff,value.sourceUpdatedAt,value.payloadHash,value.payload,value.updatedAt);updated++;}}for(const id of existing.keys())if(!next.has(id)){remove.run(domain,id);removed++;}db.exec('COMMIT');}catch(error){db.exec('ROLLBACK');throw error;}
    this.setState(`sync:${domain}`,{lastSuccess:now(),itemCount:items.length,updated,removed});return{updated,removed,total:items.length,unchanged:updated===0&&removed===0};
  }
  async replaceDomain(domain,items){await this.initialize();return this.replaceDomainSync(domain,items);}
  async upsertDomainItem(domain,item){await this.initialize();const value=this.row(item,domain),before=this.db().prepare('SELECT payload_hash FROM library_items WHERE domain=? AND id=?').get(domain,value.id);if(before?.payload_hash===value.payloadHash)return{updated:0,total:await this.countDomain(domain),item,unchanged:true};this.db().prepare(`INSERT INTO library_items(domain,id,title,sort_title,year,monitoring,state,has_file,missing_count,cutoff_count,source_updated_at,payload_hash,payload_json,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(domain,id) DO UPDATE SET title=excluded.title,sort_title=excluded.sort_title,year=excluded.year,monitoring=excluded.monitoring,state=excluded.state,has_file=excluded.has_file,missing_count=excluded.missing_count,cutoff_count=excluded.cutoff_count,source_updated_at=excluded.source_updated_at,payload_hash=excluded.payload_hash,payload_json=excluded.payload_json,updated_at=excluded.updated_at`).run(value.domain,value.id,value.title,value.sortTitle,value.year,value.monitoring,value.state,value.hasFile,value.missing,value.cutoff,value.sourceUpdatedAt,value.payloadHash,value.payload,value.updatedAt);return{updated:1,total:await this.countDomain(domain),item,created:!before};}
  async removeDomainItem(domain,id){await this.initialize();const result=this.db().prepare('DELETE FROM library_items WHERE domain=? AND id=?').run(domain,publicId(domain,id));return{removed:Number(result.changes),total:await this.countDomain(domain)};}
  async getDomainItem(domain,id){await this.initialize();const row=this.db().prepare('SELECT payload_json FROM library_items WHERE domain=? AND id=?').get(domain,publicId(domain,id));return row?parse(row.payload_json):null;}
  async countDomain(domain){await this.initialize();return Number(this.db().prepare('SELECT count(*) count FROM library_items WHERE domain=?').get(domain).count);}
  async synchronizationState(domain){await this.initialize();return this.getState(`sync:${domain}`,null);}
  async integrityCheck(){await this.initialize();const row=this.db().prepare('PRAGMA integrity_check').get(),value=String(row?.integrity_check||Object.values(row||{})[0]||'unknown');return{ok:value.toLowerCase()==='ok',result:value};}
  async domainIntegrity(domain){await this.initialize();const db=this.db(),count=await this.countDomain(domain),invalid=Number(db.prepare('SELECT count(*) count FROM library_items WHERE domain=? AND json_valid(payload_json)=0').get(domain).count),externalPath=domain==='movie'?'$.tmdbId':'$.tvdbId',duplicates=Number(db.prepare(`SELECT count(*) count FROM (SELECT json_extract(payload_json,?) value FROM library_items WHERE domain=? AND json_extract(payload_json,?) IS NOT NULL GROUP BY value HAVING count(*)>1)`).get(externalPath,domain,externalPath).count);return{count,invalidPayloads:invalid,duplicateExternalIds:duplicates,ok:invalid===0&&duplicates===0};}
  async attentionSummary(domain){await this.initialize();const row=this.db().prepare("SELECT coalesce(sum(CASE WHEN monitoring<>'none' THEN missing_count ELSE 0 END),0) missing,coalesce(sum(CASE WHEN monitoring<>'none' THEN cutoff_count ELSE 0 END),0) cutoff FROM library_items WHERE domain=?").get(domain);return{missing:Number(row.missing),cutoff:Number(row.cutoff)};}
  async librarySummary(domain){await this.initialize();const row=this.db().prepare("SELECT count(*) total,coalesce(sum(CASE WHEN monitoring<>'none' THEN 1 ELSE 0 END),0) monitored,coalesce(sum(CASE WHEN (?='movie' AND has_file=1) OR (?='tv' AND missing_count=0) THEN 1 ELSE 0 END),0) covered FROM library_items WHERE domain=?").get(domain,domain,domain);return{total:Number(row.total),monitored:Number(row.monitored),covered:Number(row.covered)};}
  async queryDomain(domain,{offset=0,limit=5000,query='',filter='all',sort='title',direction='ascending',randomSeed=0}={}){
    await this.initialize();const where=['domain=?'],params=[domain],term=String(query).trim().toLocaleLowerCase();if(term){where.push('(sort_title LIKE ? OR title LIKE ?)');params.push(`%${term}%`,`%${term}%`);}if(filter==='monitored')where.push("monitoring<>'none'");if(filter==='unmonitored')where.push("monitoring='none'");if(filter==='missing')where.push("monitoring<>'none' AND missing_count>0");if(filter==='cutoff')where.push("monitoring<>'none' AND cutoff_count>0");
    const movie=domain==='movie',datePath=movie?'$.releaseDate':'$.firstAired',columns={title:'sort_title',year:'year',releaseDate:`julianday(json_extract(payload_json,'${datePath}'))`,rating:"nullif(json_extract(payload_json,'$.rating'),0)",certification:"nullif(json_extract(payload_json,'$.certification'),'')",duration:"nullif(json_extract(payload_json,'$.runtimeMinutes'),0)",added:"julianday(json_extract(payload_json,'$.addedAt'))",size:"nullif(json_extract(payload_json,'$.sizeOnDisk'),0)",completion:movie?"CASE WHEN has_file=1 THEN 100 ELSE 0 END":"coalesce(json_extract(payload_json,'$.completionPercent'),CASE WHEN missing_count=0 THEN 100 ELSE 0 END)",attention:movie?"CASE WHEN state='missing' THEN 2 WHEN state='cutoff' THEN 1 ELSE 0 END":"missing_count+cutoff_count"},column=columns[sort]||'sort_title',order=direction==='descending'?'DESC':'ASC',clamped=Math.max(1,Math.min(5000,Number(limit)||60)),start=Math.max(0,Number(offset)||0),clause=where.join(' AND '),total=Number(this.db().prepare(`SELECT count(*) count FROM library_items WHERE ${clause}`).get(...params).count),random=sort==='random',orderColumn=random?'abs((length(id)*1103515245 + unicode(substr(id,-1))*12345 + ?) % 2147483647)':column,orderParams=random?[Math.abs(Number(randomSeed)||0)%2147483647]:[],nullOrder=random?'0':`(${orderColumn}) IS NULL`,yearTie=sort==='year'?`, julianday(json_extract(payload_json,'${datePath}')) ${order}`:'',rows=this.db().prepare(`SELECT payload_json FROM library_items WHERE ${clause} ORDER BY ${nullOrder} ASC, ${orderColumn} ${order}${yearTie}, sort_title ASC, id ASC LIMIT ? OFFSET ?`).all(...params,...orderParams,clamped,start),groups=this.db().prepare(`SELECT CASE WHEN upper(substr(trim(title),1,1)) BETWEEN 'A' AND 'Z' THEN upper(substr(trim(title),1,1)) ELSE '#' END letter,count(*) count FROM library_items WHERE ${clause} GROUP BY letter ORDER BY CASE WHEN letter='#' THEN 0 ELSE 1 END,letter`).all(...params);let cursor=0;const letters={};for(const group of groups){letters[group.letter]={offset:cursor,count:Number(group.count)};cursor+=Number(group.count);}
    return{items:rows.map(row=>parse(row.payload_json)).filter(Boolean),total,offset:start,limit:clamped,hasMore:start+rows.length<total,letters};
  }
  async domain(domain){return(await this.queryDomain(domain,{limit:5000})).items;}
  setState(key,value){this.db().prepare('INSERT INTO catalog_state(key,value_json,updated_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json,updated_at=excluded.updated_at').run(key,serialize(value),now());return value;}
  getState(key,fallback=null){const row=this.db().prepare('SELECT value_json FROM catalog_state WHERE key=?').get(key);return row?parse(row.value_json):fallback;}
  async load(){await this.initialize();return{version:2,domains:{movie:await this.domain('movie'),tv:await this.domain('tv')},operations:this.getState('operations',{queue:[],history:[],calendar:[],health:[]}),updatedAt:this.getState('updatedAt',null)};}
  async replaceOperations(operations){await this.initialize();this.setState('operations',operations);this.setState('updatedAt',now());return structuredClone(operations);}
  async operations(){await this.initialize();return this.getState('operations',{queue:[],history:[],calendar:[],health:[]});}
  async enqueueEvent({dedupeKey,domain,mediaId=null,eventType,payload={}}){await this.initialize();const timestamp=now();this.db().prepare(`INSERT INTO event_queue(dedupe_key,domain,media_id,event_type,payload_json,status,attempts,available_at,created_at,updated_at) VALUES(?,?,?,?,?,'pending',0,?,?,?) ON CONFLICT(dedupe_key) DO NOTHING`).run(dedupeKey,domain,mediaId, eventType,serialize(payload),Date.now(),timestamp,timestamp);return this.db().prepare('SELECT * FROM event_queue WHERE dedupe_key=?').get(dedupeKey);}
  async claimEvents(limit=25){await this.initialize();const db=this.db(),rows=db.prepare("SELECT * FROM event_queue WHERE status IN ('pending','retry') AND available_at<=? ORDER BY id LIMIT ?").all(Date.now(),limit);if(rows.length){const statement=db.prepare("UPDATE event_queue SET status='processing',attempts=attempts+1,updated_at=? WHERE id=?");db.exec('BEGIN IMMEDIATE');try{for(const row of rows)statement.run(now(),row.id);db.exec('COMMIT');}catch(error){db.exec('ROLLBACK');throw error;}}return rows.map(row=>({...row,payload:parse(row.payload_json)||{}}));}
  async completeEvent(id){await this.initialize();this.db().prepare("UPDATE event_queue SET status='complete',updated_at=? WHERE id=?").run(now(),id);}
  async retryEvent(id,error,delayMs=10000){await this.initialize();this.db().prepare("UPDATE event_queue SET status='retry',available_at=?,last_error=?,updated_at=? WHERE id=?").run(Date.now()+delayMs,String(error||'').slice(0,1000),now(),id);}
  async retryFailedEvents(domain){await this.initialize();const result=this.db().prepare("UPDATE event_queue SET status='retry',available_at=?,updated_at=? WHERE domain=? AND status='retry'").run(Date.now(),now(),domain);return Number(result.changes);}
  async eventStats(){await this.initialize();return Object.fromEntries(this.db().prepare('SELECT status,count(*) count FROM event_queue GROUP BY status').all().map(row=>[row.status,Number(row.count)]));}
  async exportSnapshot(){return this.load();}
  async restoreSnapshot(snapshot={}){await this.initialize();for(const domain of ['movie','tv'])this.replaceDomainSync(domain,snapshot.domains?.[domain]||[]);if(snapshot.operations)this.setState('operations',snapshot.operations);this.setState('restoredAt',now());return{movie:await this.countDomain('movie'),tv:await this.countDomain('tv')};}
  async artworkGet(cacheKey){await this.initialize();const row=this.db().prepare('SELECT * FROM artwork_index WHERE cache_key=?').get(cacheKey);if(!row)return null;this.db().prepare('UPDATE artwork_index SET last_accessed_at=? WHERE cache_key=?').run(Date.now(),cacheKey);return{file:row.file_name,contentType:row.content_type,size:Number(row.size),cachedAt:Number(row.cached_at),sourceRevision:row.source_revision||null};}
  async artworkSet(cacheKey,value){await this.initialize();this.db().prepare(`INSERT INTO artwork_index(cache_key,file_name,content_type,size,cached_at,last_accessed_at,source_revision) VALUES(?,?,?,?,?,?,?) ON CONFLICT(cache_key) DO UPDATE SET file_name=excluded.file_name,content_type=excluded.content_type,size=excluded.size,cached_at=excluded.cached_at,last_accessed_at=excluded.last_accessed_at,source_revision=excluded.source_revision`).run(cacheKey,value.file,value.contentType,Number(value.size)||0,Number(value.cachedAt)||Date.now(),Date.now(),value.sourceRevision||null);}
  async artworkRemovePrefix(prefix){await this.initialize();const rows=this.db().prepare('SELECT file_name FROM artwork_index WHERE cache_key LIKE ?').all(`${prefix}%`);this.db().prepare('DELETE FROM artwork_index WHERE cache_key LIKE ?').run(`${prefix}%`);return rows.map(row=>row.file_name);}
  async artworkStats(){await this.initialize();const row=this.db().prepare('SELECT count(*) count,coalesce(sum(size),0) bytes FROM artwork_index').get();return{items:Number(row.count),bytes:Number(row.bytes)};}
  async close(){this.database?.close();this.database=null;this.initialized=false;}
}

import { useEffect,useMemo,useRef,useState } from 'react';
import type { LibraryItem } from './library-types';
import type { CollectionKind,CollectionRules,CollectionsMountOptions,MediaCollection } from './collection-types';

const emptyRules:CollectionRules={titleContains:'',genres:[],year:'',decade:'',collection:'',monitoring:'',availability:''};
const message=(error:unknown)=>error instanceof Error?error.message:'VynodeArr could not complete this request.';

function normalizedRules(collection?:MediaCollection):CollectionRules{
  return {...emptyRules,...collection?.rules,titleContains:collection?.rules?.titleContains||collection?.titleContains||'',genres:collection?.rules?.genres||[]};
}
function hasRules(rules:CollectionRules){return Boolean(rules.titleContains||rules.genres.length||rules.year||rules.decade||rules.collection||rules.monitoring||rules.availability);}
function matches(movie:LibraryItem,rules:CollectionRules){
  const title=rules.titleContains.trim().toLowerCase();
  return(!title||movie.title.toLowerCase().includes(title))
    &&(!rules.genres.length||rules.genres.every(genre=>movie.genres?.includes(genre)))
    &&(!rules.year||movie.year===rules.year)
    &&(!rules.decade||Boolean(movie.year&&movie.year>=rules.decade&&movie.year<rules.decade+10))
    &&(!rules.collection||movie.collection===rules.collection)
    &&(!rules.monitoring||(rules.monitoring==='monitored'?movie.monitoring!=='none':movie.monitoring==='none'))
    &&(!rules.availability||(rules.availability==='available'?movie.hasFile:!movie.hasFile));
}
function ruleLabels(collection:MediaCollection){
  if(collection.type==='custom')return['Hand-picked'];
  const rules=normalizedRules(collection),labels:string[]=[];
  if(rules.titleContains)labels.push(`Title: ${rules.titleContains}`);
  labels.push(...rules.genres.map(value=>`Genre: ${value}`));
  if(rules.year)labels.push(`Year: ${rules.year}`);
  if(rules.decade)labels.push(`${rules.decade}s`);
  if(rules.collection)labels.push(`Collection: ${rules.collection}`);
  if(rules.monitoring)labels.push(rules.monitoring==='monitored'?'Monitored':'Unmonitored');
  if(rules.availability)labels.push(rules.availability==='available'?'On disk':'Missing');
  return labels;
}

function CollectionBuilder({existing,movies,request,notify,onClose,onSaved}:{existing?:MediaCollection;movies:LibraryItem[];request:CollectionsMountOptions['request'];notify:CollectionsMountOptions['notify'];onClose:()=>void;onSaved:(collection:MediaCollection)=>void}){
  const dialogRef=useRef<HTMLDialogElement>(null);
  const [name,setName]=useState(existing?.name||''),[type,setType]=useState<CollectionKind>(existing?.type||'smart'),[rules,setRules]=useState(()=>normalizedRules(existing)),[query,setQuery]=useState(''),[saving,setSaving]=useState(false);
  const [selected,setSelected]=useState(()=>new Set(existing?.movieIds||[])),[retained,setRetained]=useState(()=>new Set(existing?.includedMovieIds||[])),[suppressed,setSuppressed]=useState(()=>new Set(existing?.excludedMovieIds||[]));
  const genres=useMemo(()=>[...new Set(movies.flatMap(movie=>movie.genres||[]))].sort(),[movies]);
  const years=useMemo(()=>[...new Set(movies.map(movie=>movie.year).filter((year):year is number=>Boolean(year)))].sort((a,b)=>b-a),[movies]);
  const decades=useMemo(()=>[...new Set(years.map(year=>Math.floor(year/10)*10))].sort((a,b)=>b-a),[years]);
  const libraryCollections=useMemo(()=>[...new Set(movies.map(movie=>movie.collection).filter((value):value is string=>Boolean(value)))].sort(),[movies]);
  const matching=useMemo(()=>new Set(hasRules(rules)?movies.filter(movie=>matches(movie,rules)).map(movie=>movie.id):[]),[movies,rules]);
  const effective=useMemo(()=>type==='custom'?selected:new Set([...matching].filter(id=>!suppressed.has(id)).concat([...retained])),[type,selected,matching,suppressed,retained]);
  const visible=useMemo(()=>movies.filter(movie=>(type==='custom'||effective.has(movie.id))&&(!query||`${movie.title} ${movie.year||''} ${(movie.genres||[]).join(' ')}`.toLowerCase().includes(query.toLowerCase()))),[movies,type,effective,query]);
  const updateRule=<K extends keyof CollectionRules>(key:K,value:CollectionRules[K])=>setRules(current=>({...current,[key]:value}));
  const toggleSelected=(id:string,checked:boolean)=>setSelected(current=>{const next=new Set(current);checked?next.add(id):next.delete(id);return next;});
  const toggleRetained=(id:string,checked:boolean)=>{setRetained(current=>{const next=new Set(current);checked?next.add(id):next.delete(id);return next;});if(checked)setSuppressed(current=>{const next=new Set(current);next.delete(id);return next;});};
  const removeSmart=(id:string)=>{setRetained(current=>{const next=new Set(current);next.delete(id);return next;});setSuppressed(current=>new Set(current).add(id));};
  useEffect(()=>{const dialog=dialogRef.current;if(!dialog)return;dialog.showModal();const cancel=(event:Event)=>{event.preventDefault();onClose();};dialog.addEventListener('cancel',cancel);return()=>dialog.removeEventListener('cancel',cancel);},[onClose]);
  async function save(event:React.FormEvent){
    event.preventDefault();if(saving)return;
    const payload={name,type,rules:type==='smart'?rules:{},movieIds:type==='custom'?[...selected]:[],includedMovieIds:type==='smart'?[...retained]:[],excludedMovieIds:type==='smart'?[...matching].filter(id=>!effective.has(id)):[]};
    setSaving(true);try{const value=await request<{item:MediaCollection}>(existing?`/api/collections/${existing.id}`:'/api/collections',{method:existing?'PUT':'POST',body:JSON.stringify(payload)});notify(existing?'Collection updated.':'Collection created.');onSaved(value.item);}catch(error){notify(message(error),'error');setSaving(false);}
  }
  return <dialog id="collection-dialog" ref={dialogRef} className="collection-builder-dialog">
    <form className="collection-builder" onSubmit={event=>void save(event)}>
      <header><div><span className="eyebrow">{existing?'EDIT COLLECTION':'NEW COLLECTION'}</span><h2>{existing?'Refine your collection':'Build a collection'}</h2><p>Combine rules, preview matches, and explicitly retain only the movies you want to keep between rule changes.</p></div><button type="button" className="icon-button close-collection" aria-label="Close" onClick={onClose}>×</button></header>
      <div className="collection-builder-layout">
        <section className="collection-builder-controls">
          <label>Collection name<input value={name} onChange={event=>setName(event.target.value)} required placeholder="My collection"/></label>
          <label>Collection type<select value={type} onChange={event=>setType(event.target.value as CollectionKind)}><option value="smart">Smart rules</option><option value="custom">Hand-picked movies</option></select></label>
          {type==='smart'?<div className="smart-rule-builder"><h3>Match all selected rules</h3>
            <label>Movie name contains<input value={rules.titleContains} onChange={event=>updateRule('titleContains',event.target.value)} placeholder="Any title"/></label>
            <div className="rule-pair"><label>Year<select value={rules.year} onChange={event=>updateRule('year',Number(event.target.value)||'')}><option value="">Any year</option>{years.map(value=><option key={value} value={value}>{value}</option>)}</select></label><label>Decade<select value={rules.decade} onChange={event=>updateRule('decade',Number(event.target.value)||'')}><option value="">Any decade</option>{decades.map(value=><option key={value} value={value}>{value}s</option>)}</select></label></div>
            <label>Existing movie collection<select value={rules.collection} onChange={event=>updateRule('collection',event.target.value)}><option value="">Any collection</option>{libraryCollections.map(value=><option key={value}>{value}</option>)}</select></label>
            <div className="rule-pair"><label>Monitoring<select value={rules.monitoring} onChange={event=>updateRule('monitoring',event.target.value)}><option value="">Any</option><option value="monitored">Monitored</option><option value="unmonitored">Unmonitored</option></select></label><label>File availability<select value={rules.availability} onChange={event=>updateRule('availability',event.target.value)}><option value="">Any</option><option value="available">Available on disk</option><option value="missing">Missing</option></select></label></div>
            <fieldset className="genre-rule"><legend>Genres <small>Choose one or more</small></legend><div>{genres.map(value=><label key={value}><input type="checkbox" checked={rules.genres.includes(value)} onChange={event=>updateRule('genres',event.target.checked?[...rules.genres,value]:rules.genres.filter(item=>item!==value))}/><span>{value}</span></label>)}</div></fieldset>
          </div>:null}
        </section>
        <section className="collection-preview">
          <div className="collection-preview-heading"><div><span className="eyebrow">LIVE PREVIEW</span><h3><strong className="preview-count">{type==='smart'?effective.size:selected.size}</strong> movies selected</h3><p className="preview-note">{type==='smart'?'Changing rules replaces the current matches. Select Retain on individual movies to keep them.':'Choose each movie to include.'}</p></div><label>Find in results<input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search selected movies"/></label></div>
          <div className="collection-preview-grid">{visible.length?visible.map(movie=>type==='custom'
            ?<label className="custom-preview-movie" key={movie.id}><input type="checkbox" checked={selected.has(movie.id)} onChange={event=>toggleSelected(movie.id,event.target.checked)}/>{movie.artwork?.url?<img src={movie.artwork.url} alt=""/>:<span className="art-fallback">M</span>}<span><strong>{movie.title}</strong><small>{movie.year} · {movie.genres?.join(', ')||'No genre'}</small></span></label>
            :<article className="preview-movie" key={movie.id}>{movie.artwork?.url?<img src={movie.artwork.url} alt=""/>:<span className="art-fallback">M</span>}<div><strong>{movie.title}</strong><small>{movie.year} · {movie.genres?.join(', ')||'No genre'}</small>{retained.has(movie.id)?<span className="retained-badge">Retained</span>:null}</div><label className="retain-preview-movie"><input type="checkbox" checked={retained.has(movie.id)} onChange={event=>toggleRetained(movie.id,event.target.checked)}/> Retain</label><button type="button" className="remove-preview-movie" onClick={()=>removeSmart(movie.id)} aria-label={`Remove ${movie.title}`}>×</button></article>)
            :<div className="empty compact"><h3>{type==='custom'?'No movies found':'No movies selected'}</h3><p>{type==='custom'?'Try another title, year, or genre.':'Adjust the rules or retain a movie.'}</p></div>}</div>
        </section>
      </div>
      <footer><button type="button" className="secondary close-collection" onClick={onClose}>Cancel</button><button className="primary" type="submit" disabled={saving}>{saving?'Saving…':existing?'Save collection':'Create collection'}</button></footer>
    </form>
  </dialog>;
}

export function CollectionsView({options}:{options:CollectionsMountOptions}){
  const {administrator,request,notify}=options,[collections,setCollections]=useState<MediaCollection[]>([]),[movies,setMovies]=useState<LibraryItem[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[editing,setEditing]=useState<MediaCollection|null|undefined>(undefined);
  async function load(){setLoading(true);setError('');try{const [collectionValue,movieValue]=await Promise.all([request<{items:MediaCollection[]}>('/api/collections'),request<{items:LibraryItem[]}>('/api/media/movies')]);setCollections(collectionValue.items||[]);setMovies(movieValue.items||[]);}catch(reason){setError(message(reason));}finally{setLoading(false);}}
  useEffect(()=>{void load();},[]);
  async function remove(collection:MediaCollection){if(!confirm(`Delete “${collection.name}”?`))return;try{await request(`/api/collections/${collection.id}`,{method:'DELETE'});setCollections(current=>current.filter(item=>item.id!==collection.id));notify('Collection deleted.');}catch(reason){notify(message(reason),'error');}}
  const saved=()=>{setEditing(undefined);void load();};
  return <div className="react-collections"><div className="hero collections-hero"><div><span className="eyebrow">CURATE YOUR LIBRARY</span><h1>Collections</h1><p className="lede">Build dynamic groups with flexible rules, then fine-tune every movie by hand.</p></div>{administrator?<button className="primary" onClick={()=>setEditing(null)}>+ New collection</button>:null}</div>
    {loading?<div className="collection-showcase skeleton">Loading collections…</div>:error?<div className="empty error-state"><h2>Collections unavailable</h2><p>{error}</p><button className="secondary" onClick={()=>void load()}>Try again</button></div>:<div className="collection-showcase">{collections.length?collections.map(collection=><article className="collection-feature" key={collection.id}><div className="collection-feature-hero" style={collection.members[0]?.artwork?.url?{'--collection-cover':`url("${collection.members[0].artwork.url}")`} as React.CSSProperties:undefined}><div><span className="eyebrow">{collection.type==='smart'?'DYNAMIC COLLECTION':'CUSTOM COLLECTION'}</span><h2>{collection.name}</h2><div className="collection-rule-chips">{ruleLabels(collection).map(label=><span key={label}>{label}</span>)}</div></div><strong className="collection-count">{collection.count}<small>movie{collection.count===1?'':'s'}</small></strong></div><div className="collection-poster-rail">{collection.members.length?collection.members.map(movie=><a href={`#movie/${movie.id}`} title={movie.title} key={movie.id}>{movie.artwork?.url?<img src={movie.artwork.url} alt={`${movie.title} poster`} loading="lazy"/>:<span className="art-fallback">M</span>}<strong>{movie.title}</strong><small>{movie.year}</small></a>):<p className="muted">No movies currently match.</p>}</div>{administrator?<div className="collection-card-actions"><button className="secondary" onClick={()=>setEditing(collection)}>Edit rules &amp; movies</button><button className="text-button" onClick={()=>void remove(collection)}>Delete</button></div>:null}</article>):<div className="empty collection-empty"><h2>Your collection shelf is empty</h2><p>Create a smart collection from flexible rules or hand-pick a custom set.</p>{administrator?<button className="primary" onClick={()=>setEditing(null)}>Create your first collection</button>:null}</div>}</div>}
    {editing!==undefined?<CollectionBuilder existing={editing||undefined} movies={movies} request={request} notify={notify} onClose={()=>setEditing(undefined)} onSaved={saved}/>:null}
  </div>;
}

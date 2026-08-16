import { useCallback,useEffect,useMemo,useState } from 'react';
import type { CalendarEvent,CalendarMountOptions } from './calendar-types';
import {EngineInstanceFilter,useEngineInstances} from './engine-instance-control';
import {errorMessage} from './shell-utils';
import './react-calendar.css';

const pad=(value:number)=>String(value).padStart(2,'0');
const dateKey=(date:Date)=>`${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`;
const eventTitle=(event:CalendarEvent)=>event.title;

export function CalendarView({options}:{options:CalendarMountOptions}){
  const today=new Date();
  const [cursor,setCursor]=useState(()=>new Date(today.getFullYear(),today.getMonth(),1));
  const [selected,setSelected]=useState(()=>dateKey(today));
  const [showMovies,setShowMovies]=useState(true);
  const [showTv,setShowTv]=useState(true);
  const [engineFilter,setEngineFilter]=useState('all');
  const engineInstances=useEngineInstances(options.request);
  const [events,setEvents]=useState<CalendarEvent[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const load=useCallback(async()=>{
    setLoading(true);
    const start=dateKey(new Date(cursor.getFullYear(),cursor.getMonth(),1));
    const end=dateKey(new Date(cursor.getFullYear(),cursor.getMonth()+1,1));
    try{
      const value=await options.request<{items:CalendarEvent[]}>(`/api/calendar?start=${start}&end=${end}&movies=${showMovies}&tv=${showTv}`);
      setEvents(value.items||[]);
      setError('');
    }catch(reason){
      setError(errorMessage(reason,'Calendar unavailable.'));
    }finally{
      setLoading(false);
    }
  },[cursor,showMovies,showTv,options]);
  useEffect(()=>{void load();},[load]);
  const byDate=useMemo(()=>{
    const map=new Map<string,CalendarEvent[]>();
    for(const event of events){
      if(engineFilter!=='all'&&event.engineInstanceId!==engineFilter)continue;
      if(!event.dateUtc)continue;
      const key=event.dateUtc.slice(0,10);
      map.set(key,[...(map.get(key)||[]),event]);
    }
    return map;
  },[events,engineFilter]);
  const start=new Date(cursor.getFullYear(),cursor.getMonth(),1);
  const days=new Date(cursor.getFullYear(),cursor.getMonth()+1,0).getDate();
  const offset=start.getDay();
  const cells=Array.from({length:Math.ceil((offset+days)/7)*7},(_,index)=>{
    const day=index-offset+1;
    if(day<1||day>days)return null;
    const key=`${cursor.getFullYear()}-${pad(cursor.getMonth()+1)}-${pad(day)}`;
    return{day,key,items:byDate.get(key)||[]};
  });
  const agenda=(byDate.get(selected)||[]).sort((left,right)=>String(left.dateUtc||'').localeCompare(String(right.dateUtc||'')));
  const selectedDate=new Date(`${selected}T12:00:00`);
  const move=(amount:number)=>{const next=new Date(cursor.getFullYear(),cursor.getMonth()+amount,1);setCursor(next);setSelected(dateKey(next));};
  const goToday=()=>{const value=new Date();setCursor(new Date(value.getFullYear(),value.getMonth(),1));setSelected(dateKey(value));};
  return <div className="react-calendar">
    <div className="hero calendar-hero"><div><span className="eyebrow">SCHEDULE</span><h1>Calendar</h1><p className="lede">Monitored movie releases and television air dates.</p></div><button className="secondary" onClick={goToday}>Today</button></div>
    <div className="management-toolbar"><EngineInstanceFilter instances={engineInstances} value={engineFilter} onChange={setEngineFilter}/></div>
    <div className="calendar-toolbar"><div><button className="secondary" aria-label="Previous month" onClick={()=>move(-1)}>←</button><button className="secondary" aria-label="Next month" onClick={()=>move(1)}>→</button><strong>{cursor.toLocaleDateString(undefined,{month:'long',year:'numeric'})}</strong></div><div><label className="check"><input type="checkbox" checked={showMovies} onChange={event=>setShowMovies(event.target.checked)}/> Movies</label><label className="check"><input type="checkbox" checked={showTv} onChange={event=>setShowTv(event.target.checked)}/> Television</label></div></div>
    <div className="calendar-layout">
      {loading?<div className="calendar-shell skeleton">Loading…</div>:error?<div className="calendar-shell"><div className="empty error-state"><h2>Calendar unavailable</h2><p>{error}</p></div></div>:<div className="calendar-shell"><div className="calendar-weekdays">{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(day=><span aria-label={day} key={day}>{day}</span>)}</div><div className="calendar-grid">{cells.map((cell,index)=>cell?<button type="button" key={cell.key} className={`calendar-day${cell.key===dateKey(today)?' today':''}${cell.key===selected?' selected':''}`} aria-label={`${new Date(`${cell.key}T12:00:00`).toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'})}${cell.items.length?`, ${cell.items.length} scheduled ${cell.items.length===1?'item':'items'}`:', nothing scheduled'}`} aria-pressed={cell.key===selected} aria-current={cell.key===dateKey(today)?'date':undefined} onClick={()=>setSelected(cell.key)}><span className="calendar-date">{cell.day}</span>{cell.items.length?<span className="calendar-count">{cell.items.length}</span>:null}<span className="calendar-day-events" aria-hidden="true">{cell.items.slice(0,3).map((event,eventIndex)=><span className={`calendar-day-event ${event.domain}`} key={`${event.domain}:${event.id}:${eventIndex}`}>{eventTitle(event)}</span>)}{cell.items.length>3?<small>+{cell.items.length-3} more</small>:null}</span></button>:<span className="calendar-day outside" aria-hidden="true" key={index}/>)}</div></div>}
      <aside className={`calendar-agenda${loading?' skeleton':''}`}><header><span className="eyebrow">{selected===dateKey(today)?'TODAY':'SELECTED DAY'}</span><h2>{selectedDate.toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'})}</h2><p>{agenda.length?`${agenda.length} scheduled ${agenda.length===1?'item':'items'}`:'No scheduled items'}</p></header><div className="calendar-agenda-list">{agenda.map((event,index)=>{const movie=event.domain==='movie',time=!movie&&event.dateUtc?new Date(event.dateUtc).toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'}):'';return <a className={`calendar-agenda-card ${event.domain}`} href={`#${movie?'movie':'series'}/${event.mediaId}`} key={`${event.domain}:${event.id}:${index}`}><img src={event.artwork?.url||`/api/artwork/${event.domain}/${event.mediaId}/poster`} alt="" loading="lazy"/><div><span className="agenda-meta">{movie?'MOVIE':'TELEVISION'}{time?` · ${time}`:''}</span><strong>{eventTitle(event)}</strong><small>{movie?'Movie release':event.context||'Television episode'}</small></div><span className="agenda-arrow">→</span></a>})}{!agenda.length?<div className="calendar-agenda-empty"><span aria-hidden="true">○</span><strong>Nothing scheduled</strong><p>Choose another day or adjust the movie and television filters.</p></div>:null}</div></aside>
    </div>
  </div>;
}

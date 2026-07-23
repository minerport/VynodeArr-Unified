const authView=document.querySelector('#auth-view'),shell=document.querySelector('#app-shell'),content=document.querySelector('#content');
const nav=[...document.querySelectorAll('nav a')],state={csrf:null,user:null,mode:null,movies:[],tv:[],query:'',filter:'all',view:'poster',sort:'title'};
const esc=(value)=>String(value??'').replace(/[&<>"']/g,(char)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const pct=(value)=>Math.max(0,Math.min(100,Number(value)||0));
const when=(value)=>value?new Date(value).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'}):'Not scheduled';
const badge=(text,tone='')=>`<span class="badge ${tone}">${esc(text)}</span>`;

async function api(path,options={}) {
  const response=await fetch(path,{...options,headers:{'content-type':'application/json',...(state.csrf?{'x-vynodenew-csrf':state.csrf}:{}),...options.headers}});
  const value=await response.json().catch(()=>({}));
  if(response.status===401&&!path.startsWith('/api/auth/')){await showAuth();throw new Error('Sign in required');}
  if(!response.ok)throw new Error(value.error?.message||'VynodeNew could not complete this request.');
  return value;
}
async function showAuth(){
  const status=await api('/api/auth/status');state.csrf=status.csrf;state.user=status.user;
  if(status.authenticated){authView.hidden=true;shell.hidden=false;document.querySelector('#account-name').textContent=status.user.username;route();return;}
  shell.hidden=true;authView.hidden=false;
  document.querySelector('#auth-title').textContent=status.setupRequired?'Create administrator':'Sign in';
  document.querySelector('#auth-copy').textContent=status.setupRequired?'Create the first local VynodeNew administrator. Use at least 12 password characters.':'Continue to your unified Movies and TV library.';
  authView.dataset.setup=String(status.setupRequired);
}
document.querySelector('#auth-form').addEventListener('submit',async(event)=>{
  event.preventDefault();const form=new FormData(event.currentTarget);const input={username:form.get('username'),password:form.get('password')};const error=document.querySelector('#auth-error');error.textContent='';
  try{if(authView.dataset.setup==='true')await api('/api/auth/setup',{method:'POST',body:JSON.stringify(input)});const result=await api('/api/auth/login',{method:'POST',body:JSON.stringify(input)});state.csrf=result.csrf;state.user=result.user;authView.hidden=true;shell.hidden=false;document.querySelector('#account-name').textContent=result.user.username;route();}
  catch(reason){error.textContent=reason.message;}
});
document.querySelector('#logout').addEventListener('click',async()=>{await api('/api/auth/logout',{method:'POST'});state.csrf=null;location.hash='';await showAuth();});
document.querySelector('.menu').addEventListener('click',()=>document.body.classList.toggle('nav-open'));
document.querySelector('#global-search').addEventListener('input',(event)=>{state.query=event.target.value.toLowerCase();if(['movies','tv'].includes(location.hash.slice(1)))renderMedia(location.hash.slice(1));});

function mediaCard(item,kind){
  const movie=kind==='movies',attention=movie?item.state!=='available':item.missingEpisodes>0;
  const image=item.artwork?.url?`<img src="${esc(item.artwork.url)}" alt="" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><span class="art-fallback" hidden>${movie?'M':'TV'}</span>`:`<span class="art-fallback">${movie?'M':'TV'}</span>`;
  const detail=movie?`${esc(item.quality)} · ${esc(item.qualityProfile||'No profile')}`:`${esc(item.episodeProgress)} episodes · ${esc(item.seasonProgress)} seasons`;
  const status=movie?(item.state==='available'?'Available':item.state):item.status;
  return `<article class="card ${state.view}" data-title="${esc(item.title)}"><a class="poster" href="#${movie?'movie':'series'}/${esc(item.id)}">${image}<div class="poster-badges">${badge(item.monitoring==='all'?'Monitored':item.monitoring,'green')}${badge(status,attention?'warm':'')}</div></a><div class="card-body"><h2><a href="#${movie?'movie':'series'}/${esc(item.id)}">${esc(item.title)}</a></h2><p>${item.year}${movie?(item.collection?` · ${esc(item.collection)}`:''):` · ${esc(item.network)}`}</p><div class="progress"><span style="width:${movie?(item.hasFile?100:0):pct(parseInt(item.episodeProgress)/Math.max(1,parseInt(item.episodeProgress.split('/')[1]))*100)}%"></span></div><div class="detail-row"><span>${detail}</span><span>${item.queue?`${pct(item.queue.progress)}% queued`:movie?(item.hasFile?'On disk':'Missing'):`${item.missingEpisodes} missing`}</span></div>${!movie&&item.nextEpisode?`<div class="next"><small>Next</small><strong>${esc(when(item.nextEpisode.airDateUtc))}</strong></div>`:''}</div></article>`;
}
function filtered(kind){
  const movie=kind==='movies';let items=[...state[kind]];
  items=items.filter((item)=>item.title.toLowerCase().includes(state.query)&&(state.filter==='all'||state.filter==='monitored'&&item.monitoring!=='none'||state.filter==='missing'&&(movie?item.state==='missing':item.missingEpisodes>0)));
  items.sort((a,b)=>state.sort==='year'?b.year-a.year:state.sort==='attention'?(movie?(a.state==='available')-(b.state==='available'):b.missingEpisodes-a.missingEpisodes):a.title.localeCompare(b.title));
  return items;
}
function renderMedia(kind){
  const movie=kind==='movies',items=filtered(kind),grid=content.querySelector('.grid');if(!grid)return;
  grid.className=`grid view-${state.view}`;grid.innerHTML=items.length?items.map((item)=>mediaCard(item,kind)).join(''):`<div class="empty"><h2>No ${movie?'movies':'series'} found</h2><p>Adjust the current search or filter.</p></div>`;
}
async function showMedia(kind){
  const movie=kind==='movies',node=document.querySelector('#media-page').content.cloneNode(true);node.querySelector('h1').textContent=movie?'Movies':'TV';node.querySelector('.lede').textContent=movie?'Every story, presented through one secure gateway.':'Every season and episode, normalized in one library.';content.replaceChildren(node);
  try{
    const value=await api(movie?'/api/media/movies':'/api/media/tv');state[kind]=value.items;state.mode=value.mode;document.querySelector('#mode-badge').textContent=value.mode==='fixture'?'Developer fixture mode':'Connected engines';
    const items=value.items;content.querySelector('.count').textContent=items.length;content.querySelector('.monitored').textContent=items.filter((item)=>item.monitoring!=='none').length;
    content.querySelector('.attention').textContent=items.filter((item)=>movie?item.state!=='available':item.missingEpisodes>0).length;
    content.querySelector('.coverage').textContent=`${Math.round(items.filter((item)=>movie?item.hasFile:item.missingEpisodes===0).length/Math.max(items.length,1)*100)}%`;
    content.querySelectorAll('[data-filter]').forEach((button)=>button.addEventListener('click',()=>{state.filter=button.dataset.filter;content.querySelectorAll('[data-filter]').forEach((item)=>item.classList.toggle('selected',item===button));renderMedia(kind);}));
    content.querySelector('.sort').addEventListener('change',(event)=>{state.sort=event.target.value;renderMedia(kind);});
    content.querySelectorAll('[data-view]').forEach((button)=>button.addEventListener('click',()=>{state.view=button.dataset.view;content.querySelectorAll('[data-view]').forEach((item)=>item.classList.toggle('selected',item===button));renderMedia(kind);}));
    renderMedia(kind);
  }catch(error){content.querySelector('.grid').innerHTML=`<div class="empty error-state"><h2>${movie?'Movie':'TV'} service unavailable</h2><p>${esc(error.message)}</p><button class="primary" onclick="location.reload()">Try again</button></div>`;}
}
async function showDetail(kind,id){
  const movie=kind==='movie';content.innerHTML='<div class="detail-skeleton skeleton"></div>';
  try{
    const {item,mode}=await api(`${movie?'/api/media/movies':'/api/media/tv'}/${encodeURIComponent(id)}`);document.querySelector('#mode-badge').textContent=mode==='fixture'?'Developer fixture mode':'Connected engines';
    const art=item.artwork?.url?`<img src="${esc(item.artwork.url)}" alt="">`:`<span class="art-fallback">${movie?'M':'TV'}</span>`;
    const facts=movie?[['Year',item.year],['Runtime',`${item.runtimeMinutes} min`],['Availability',item.availability],['Quality',item.quality],['Profile',item.qualityProfile],['Collection',item.collection||'None']]:[['Network',item.network],['Status',item.status],['Monitoring',item.monitoring],['Episodes',item.episodeProgress],['Missing',item.missingEpisodes],['Next',item.nextEpisode?when(item.nextEpisode.airDateUtc):'Complete']];
    content.innerHTML=`<a class="back-link" href="#${movie?'movies':'tv'}">← Back to ${movie?'Movies':'TV'}</a><section class="detail-hero"><div class="detail-art">${art}</div><div><span class="eyebrow">${movie?'MOVIE':'TV SERIES'}</span><h1>${esc(item.title)}</h1><p class="lede">${esc(item.overview)}</p><div class="badges">${badge(item.monitoring,'green')}${badge('Read-only review mode')}</div></div></section><div class="fact-grid">${facts.map(([key,value])=>`<div><small>${esc(key)}</small><strong>${esc(value)}</strong></div>`).join('')}</div>${movie?'':`<section class="panel"><h2>Seasons</h2>${item.seasons.map((season)=>`<details><summary>Season ${season.seasonNumber}<span>${season.episodeFileCount} / ${season.episodeCount} · ${season.monitored?'Monitored':'Not monitored'}</span></summary>${season.episodes.map((episode)=>`<div class="episode"><span>${episode.episodeNumber}. ${esc(episode.title)}</span><span>${episode.hasFile?'Available':'Missing'} · ${episode.monitored?'Monitored':'Not monitored'}</span></div>`).join('')}</details>`).join('')}</section>`}<section class="split-panels"><div class="panel"><h2>Recent history</h2>${rows(item.recentHistory||[],'history')}</div><div class="panel"><h2>Calendar</h2>${rows(item.calendar||[],'calendar')}</div></section>`;
  }catch(error){content.innerHTML=`<div class="empty error-state"><h2>Media details unavailable</h2><p>${esc(error.message)}</p></div>`;}
}
function rows(items,type){return items.length?items.slice(0,20).map((item)=>`<div class="data-row"><span><strong>${esc(item.title)}</strong><small>${esc(type==='calendar'?item.context||item.eventType:item.eventType||item.status)}</small></span><span>${esc(when(item.dateUtc||item.timestamp||item.eta))}</span></div>`).join(''):'<p class="muted">No items to display.</p>';}
async function showOperational(name,path){
  content.innerHTML=`<div class="hero"><div><span class="eyebrow">UNIFIED</span><h1>${esc(name)}</h1><p class="lede">Movies and TV in one normalized view.</p></div><span class="read-only">Read-only review mode</span></div><div class="panel skeleton">Loading…</div>`;
  try{const {items}=await api(path);content.querySelector('.panel').className='panel';content.querySelector('.panel').innerHTML=rows(items,name.toLowerCase());}catch(error){content.querySelector('.panel').innerHTML=`<div class="empty error-state"><h2>${esc(name)} unavailable</h2><p>${esc(error.message)}</p></div>`;}
}
async function showDashboard(){
  content.innerHTML='<div class="hero"><div><span class="eyebrow">VYNODENEW</span><h1>Dashboard</h1><p class="lede">One secure horizon for Movies and TV.</p></div><span class="read-only">Read-only review mode</span></div><div class="dashboard-grid skeleton">Loading your libraries…</div>';
  try{const [movies,tv,queue,calendar]=await Promise.all([api('/api/media/movies'),api('/api/media/tv'),api('/api/activity/queue'),api('/api/calendar')]);state.mode=movies.mode;document.querySelector('#mode-badge').textContent=movies.mode==='fixture'?'Developer fixture mode':'Connected engines';content.querySelector('.dashboard-grid').className='dashboard-grid';content.querySelector('.dashboard-grid').innerHTML=[['Movies',movies.items.length,'#movies'],['TV series',tv.items.length,'#tv'],['Queue',queue.items.length,'#queue'],['Upcoming',calendar.items.length,'#calendar']].map(([label,count,href])=>`<a class="metric" href="${href}"><strong>${count}</strong><span>${label}</span></a>`).join('');}catch(error){content.querySelector('.dashboard-grid').innerHTML=`<div class="empty error-state"><h2>Dashboard unavailable</h2><p>${esc(error.message)}</p></div>`;}
}
async function showSettings(){
  content.innerHTML='<div class="hero"><div><span class="eyebrow">ADMINISTRATION</span><h1>Settings</h1><p class="lede">Engine connections are configured securely outside the browser in N2.</p></div></div><div class="panel skeleton">Testing read-only connections…</div>';
  try{const value=await api('/api/system/engines');content.querySelector('.panel').className='panel engine-list';content.querySelector('.panel').innerHTML=`<div class="notice">Developer data mode: <strong>${esc(value.mode)}</strong>. Credentials are never returned.</div>${value.engines.map((engine)=>`<article><div><h2>${esc(engine.displayName)}</h2><p>${engine.connection.reachable?'Reachable':'Unavailable'} · ${engine.connection.latencyMs} ms · ${engine.connection.compatible?'Compatible':'Compatibility unknown'}</p></div>${badge(engine.connection.reachable?'Ready':'Unavailable',engine.connection.reachable?'green':'warm')}<dl><dt>Enabled</dt><dd>${engine.configuration.enabled}</dd><dt>Credential</dt><dd>${engine.configuration.credentialConfigured?'Configured':'Not configured'}</dd><dt>Last sync</dt><dd>${esc(engine.synchronization.lastSuccess||'Never')}</dd><dt>Capabilities</dt><dd>${esc(engine.connection.capabilities.join(', ')||'None')}</dd></dl></article>`).join('')}`;}catch(error){content.querySelector('.panel').innerHTML=`<div class="empty error-state"><h2>Settings unavailable</h2><p>${esc(error.message)}</p></div>`;}
}
function showSystem(){content.innerHTML='<div class="hero"><div><span class="eyebrow">SYSTEM</span><h1>System</h1><p class="lede">VynodeNew gateway status and synchronization controls.</p></div></div><div class="panel"><h2>Review deployment</h2><p>The gateway is healthy. Media mutations are disabled.</p><button id="sync-now" class="primary">Synchronize now</button><p id="sync-result" class="muted"></p></div>';document.querySelector('#sync-now').addEventListener('click',async()=>{const button=document.querySelector('#sync-now');button.disabled=true;try{await api('/api/system/sync',{method:'POST'});document.querySelector('#sync-result').textContent='Synchronization completed.';}catch(error){document.querySelector('#sync-result').textContent=error.message;}finally{button.disabled=false;}});}
async function route(){
  if(shell.hidden)return;const raw=location.hash.slice(1)||'dashboard',parts=raw.split('/'),key=parts[0];nav.forEach((link)=>link.classList.toggle('active',link.hash===`#${key}`));document.body.classList.remove('nav-open');
  if(key==='movies'||key==='tv')return showMedia(key);if(key==='movie'||key==='series')return showDetail(key,parts[1]);if(key==='queue')return showOperational('Queue','/api/activity/queue');if(key==='history')return showOperational('History','/api/activity/history');if(key==='calendar')return showOperational('Calendar','/api/calendar');if(key==='settings')return showSettings();if(key==='system')return showSystem();return showDashboard();
}
addEventListener('hashchange',route);showAuth();

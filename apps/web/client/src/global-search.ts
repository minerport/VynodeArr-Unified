import type {AppState} from "./app-state";

type SearchItem={title:string;description:string;href:string;keywords?:string;kind:"Movie"|"Television"|"Page"|"Setting"};
type Request=(path:string,options?:RequestInit)=>Promise<unknown>;

const destinations:SearchItem[]=[
  ["Dashboard","Library health, downloads, and engine activity","#dashboard","home overview","Page"],
  ["Discover","Find movies and television from TMDB","#discover","browse trending genres services","Page"],
  ["My Requests","Track your media requests","#requests","requested pending imported","Page"],
  ["Movies","Browse and manage the movie library","#movies","film library","Page"],
  ["Collections","Build and manage collections","#collections","smart custom rules","Page"],
  ["Lists","Import lists and synchronize Plex collections","#lists","Reeltrack Plex trailers","Page"],
  ["Television","Browse series, seasons, and episodes","#tv","tv shows library","Page"],
  ["Add Media","Search for and add movies or shows","#add","request lookup","Page"],
  ["Calendar","Upcoming movie and episode releases","#calendar","schedule upcoming","Page"],
  ["Action Center","Review operations requiring attention","#operations","activity actions","Page"],
  ["User Requests","Review and approve user requests","#request-management","approval decisions","Page"],
  ["Queue","Monitor current downloads and imports","#queue","downloading client","Page"],
  ["History","Review download and import history","#history","activity events","Page"],
  ["Wanted","Review missing and cutoff-unmet media","#wanted","missing search cutoff","Page"],
  ["Root Folders","Configure movie and television storage","#service/root-folders","paths media folders destinations","Setting"],
  ["Library Health","Review media-engine health warnings","#service/library-health","errors warnings","Setting"],
  ["Library Review","Compare Plex, VynodeArr, and folders","#service/library-review","matching scanned files","Setting"],
  ["Media Management","Configure naming and organization","#service/media-management","rename folders files","Setting"],
  ["Poster Overlays and Plex","Connect Plex and manage poster artwork","#service/poster-overlays","plex server token artwork styles","Setting"],
  ["Quality Profiles","Configure qualities, upgrades, and cutoffs","#service/profiles","resolution sizes","Setting"],
  ["Custom Formats","Configure custom format scoring","#service/custom-formats","scores release rules","Setting"],
  ["Guide Templates","Apply reusable quality templates","#service/guide-templates","trash guides presets","Setting"],
  ["Release Profiles","Configure required and ignored release terms","#service/release-profiles","must contain indexer tags","Setting"],
  ["Indexers","Configure search providers","#service/indexers","usenet torrent providers","Setting"],
  ["Download Clients","Configure download applications","#service/download-clients","sabnzbd nzbget client","Setting"],
  ["Import Lists","Configure engine import-list providers","#service/import-lists","provider lists","Setting"],
  ["Discover Settings","Configure TMDB metadata","#service/discover","api token","Setting"],
  ["Account Settings","Manage profile, appearance, and security","#settings/account","theme password users permissions","Setting"],
  ["Setup Overview","Complete the essential VynodeArr setup","#setup","install onboarding getting started requirements","Setup"],
  ["Media Engines","Configure built-in or external media engines","#setup/engines","movie television engine connection api","Setup"],
  ["Storage & Destinations","Configure downloads and final media locations","#setup/storage","root folders paths media defaults","Setup"],
  ["Search & Downloads","Configure indexers and download clients","#setup/search","providers release sources sabnzbd qbittorrent","Setup"],
  ["Integrations","Connect TMDB Plex and Reeltrack","#setup/integrations","metadata artwork lists optional","Setup"],
  ["System","Backups, updates, logs, and diagnostics","#system","restore version performance","Setting"],
].map(([title,description,href,keywords,kind])=>({title,description,href,keywords,kind:kind as SearchItem["kind"]}));

const text=(value:unknown)=>String(value??"").toLocaleLowerCase();
const mediaItems=(items:Record<string,unknown>[],kind:"Movie"|"Television",route:"movie"|"series"):SearchItem[]=>items.map(item=>({
  title:String(item.title||"Untitled"),
  description:[kind,item.year,item.network].filter(Boolean).join(" · "),
  href:`#${route}/${String(item.id||"")}`,
  keywords:[item.year,item.network,item.status,...(Array.isArray(item.genres)?item.genres:[])].filter(Boolean).join(" "),
  kind,
}));

export function wireGlobalSearch(input:HTMLInputElement,state:Pick<AppState,"movies"|"tv"|"query">,request:Request){
  const host=document.createElement("div");
  host.className="global-search-results";
  host.hidden=true;
  input.parentElement?.append(host);
  let loading=false,active=-1,results:SearchItem[]=[];
  const close=()=>{host.hidden=true;active=-1;};
  const load=async()=>{
    if(loading||(state.movies.length&&state.tv.length))return;
    loading=true;
    try{
      const [movies,tv]=await Promise.all([
        state.movies.length?Promise.resolve({items:state.movies}):request("/api/media/movies") as Promise<{items?:Record<string,unknown>[]}>,
        state.tv.length?Promise.resolve({items:state.tv}):request("/api/media/tv") as Promise<{items?:Record<string,unknown>[]}>,
      ]);
      if(!state.movies.length)state.movies=movies.items||[];
      if(!state.tv.length)state.tv=tv.items||[];
    }catch{}finally{loading=false;render();}
  };
  const render=()=>{
    const query=text(input.value).trim();
    state.query=query;
    if(!query){close();host.replaceChildren();return;}
    const all=[...destinations,...mediaItems(state.movies,"Movie","movie"),...mediaItems(state.tv,"Television","series")];
    results=all.filter(item=>text(`${item.title} ${item.description} ${item.keywords||""}`).includes(query)).sort((a,b)=>{
      const aTitle=text(a.title),bTitle=text(b.title);
      return Number(bTitle.startsWith(query))-Number(aTitle.startsWith(query))||aTitle.localeCompare(bTitle);
    }).slice(0,12);
    host.innerHTML=results.length?results.map((item,index)=>`<a href="${item.href}" data-index="${index}"${index===active?' class="active"':''}><span><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.description)}</small></span><em>${item.kind}</em></a>`).join(""):`<div class="global-search-empty">No titles, pages, or settings match “${escapeHtml(input.value)}”.</div>`;
    host.hidden=false;
  };
  input.setAttribute("autocomplete","off");
  input.setAttribute("aria-label","Search titles, pages, and settings");
  input.placeholder="Search titles, pages, and settings";
  input.addEventListener("focus",()=>{void load();if(input.value.trim())render();});
  input.addEventListener("input",()=>{active=-1;render();void load();});
  input.addEventListener("keydown",event=>{
    if(event.key==="Escape"){close();input.blur();return;}
    if(event.key==="ArrowDown"||event.key==="ArrowUp"){
      event.preventDefault();active=Math.max(0,Math.min(results.length-1,active+(event.key==="ArrowDown"?1:-1)));render();
    }else if(event.key==="Enter"&&results.length){event.preventDefault();location.hash=results[Math.max(0,active)].href.slice(1);input.value="";state.query="";close();}
  });
  host.addEventListener("click",()=>{input.value="";state.query="";close();});
  document.addEventListener("pointerdown",event=>{if(!input.parentElement?.contains(event.target as Node))close();});
}

function escapeHtml(value:unknown){return String(value??"").replace(/[&<>"']/g,character=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[character]!));}

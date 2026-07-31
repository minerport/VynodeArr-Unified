import type {AppState,LibraryKind} from './app-state';

export type ToastTone='success'|'error'|'info'|string;
export type Notify=(message:unknown,tone?:ToastTone)=>void;

export function createNotifier(toast:HTMLElement):Notify{
  let timer:number|undefined;
  return(message,tone='success')=>{
    if(/abort/i.test(String(message)))return;
    toast.textContent=String(message);
    toast.className=`toast ${tone}`;
    toast.hidden=false;
    if(timer!==undefined)window.clearTimeout(timer);
    timer=window.setTimeout(()=>{toast.hidden=true;},tone==='error'?6500:3500);
  };
}

export interface ShellUser{
  name?:string;
  username?:string;
  role?:string;
  theme?:string;
  uiStyle?:string;
  uiDensity?:string;
  motionPreference?:string;
  [key:string]:unknown;
}

interface UserPresentationElements{
  accountName:HTMLElement;
  accountRole:HTMLElement;
  avatar:HTMLElement;
  documentElement:HTMLElement;
}

export function applyUserPresentation(
  state:Pick<AppState,'user'>,
  user:ShellUser,
  elements:UserPresentationElements
){
  state.user=user;
  const displayName=user.name||user.username||'Account';
  elements.accountName.textContent=displayName;
  elements.accountRole.textContent=user.role||'user';
  elements.avatar.textContent=displayName.charAt(0).toUpperCase()||'A';
  if(user.theme)elements.documentElement.dataset.theme=user.theme;
  elements.documentElement.dataset.uiStyle=user.uiStyle||'glass';
  elements.documentElement.dataset.uiDensity=user.uiDensity||'comfortable';
  elements.documentElement.dataset.motion=user.motionPreference||'system';
}

interface ShellControlsOptions{
  state:Pick<AppState,'csrf'|'user'|'query'|'dirty'|'sessionMessage'>;
  logoutButton:HTMLElement;
  menuButton:HTMLElement;
  globalSearch:HTMLInputElement;
  request:(path:string,options?:RequestInit)=>Promise<unknown>;
  bootstrap:()=>Promise<void>;
  renderLibrary:(kind:LibraryKind)=>unknown;
}

export function wireShellControls(options:ShellControlsOptions){
  const sidebar=document.querySelector<HTMLElement>('#primary-sidebar');
  const scrim=document.querySelector<HTMLButtonElement>('.nav-scrim');
  let lastFocused:HTMLElement|null=null;
  const setNavigation=(open:boolean)=>{
    if(document.body.classList.contains('nav-open')!==open)document.body.classList.toggle('nav-open');
    options.menuButton.setAttribute('aria-expanded',String(open));
    options.menuButton.setAttribute('aria-label',open?'Close navigation':'Open navigation');
    if(open){
      lastFocused=document.activeElement instanceof HTMLElement?document.activeElement:null;
      window.requestAnimationFrame(()=>sidebar?.querySelector<HTMLElement>('a,button')?.focus());
    }else if(lastFocused&&document.contains(lastFocused)){
      lastFocused.focus();
    }
  };
  options.logoutButton.addEventListener('click',async()=>{
    await options.request('/api/auth/logout',{method:'POST'});
    options.state.csrf=null;
    options.state.user=null;
    location.hash='';
    options.state.sessionMessage='Signed out successfully.';
    await options.bootstrap();
  });
  options.menuButton.addEventListener('click',()=>setNavigation(!document.body.classList.contains('nav-open')));
  scrim?.addEventListener('click',()=>setNavigation(false));
  sidebar?.addEventListener('click',event=>{
    if((event.target as Element).closest('a[href]'))setNavigation(false);
  });
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&document.body.classList.contains('nav-open')){
      event.preventDefault();
      setNavigation(false);
      return;
    }
    if(event.key!=='Tab'||!document.body.classList.contains('nav-open')||!sidebar)return;
    const focusable=[...sidebar.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),select,input')].filter(element=>element.offsetParent!==null);
    if(!focusable.length)return;
    const first=focusable[0],last=focusable.at(-1)!;
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  });
  options.globalSearch.addEventListener('input',()=>{
    options.state.query=options.globalSearch.value.toLowerCase();
    const route=location.hash.slice(1);
    if(route==='movies'||route==='tv')options.renderLibrary(route);
  });
  addEventListener('beforeunload',event=>{
    if(!options.state.dirty)return;
    event.preventDefault();
    event.returnValue='';
  });
}

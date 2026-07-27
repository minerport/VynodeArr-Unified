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
  options.logoutButton.addEventListener('click',async()=>{
    await options.request('/api/auth/logout',{method:'POST'});
    options.state.csrf=null;
    options.state.user=null;
    location.hash='';
    options.state.sessionMessage='Signed out successfully.';
    await options.bootstrap();
  });
  options.menuButton.addEventListener('click',()=>document.body.classList.toggle('nav-open'));
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

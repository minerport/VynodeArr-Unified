export interface SessionUser{
  name?:string;
  username?:string;
  role?:string;
  theme?:string;
  uiStyle?:string;
  uiDensity?:string;
  motionPreference?:string;
  [key:string]:unknown;
}

export interface SessionState{
  csrf:string|null;
  user:SessionUser|null;
  enginesConfigured:boolean;
  sessionMessage:string;
}

export interface AuthenticationResult{
  csrf:string;
  user:SessionUser;
  enginesConfigured:boolean;
}

interface AuthenticationStatus{
  csrf:string|null;
  user:SessionUser|null;
  enginesConfigured:boolean;
  setupRequired:boolean;
  authenticated:boolean;
}

interface SessionElements{
  setupView:HTMLElement;
  authView:HTMLElement;
  shell:HTMLElement;
}

interface BootstrapOptions extends SessionElements{
  state:SessionState;
  request:<T=unknown>(path:string,options?:RequestInit)=>Promise<T>;
  applyUser:(user:SessionUser)=>void;
  startImportMonitor:()=>void;
  route:()=>void;
}

export async function bootstrapSession(options:BootstrapOptions){
  const status=await options.request<AuthenticationStatus>('/api/auth/status');
  options.state.csrf=status.csrf;
  options.state.user=status.user;
  options.state.enginesConfigured=status.enginesConfigured;
  options.setupView.hidden=!status.setupRequired;
  options.authView.hidden=status.setupRequired||status.authenticated;
  options.shell.hidden=!status.authenticated;
  if(status.setupRequired)return;
  if(!status.authenticated){
    const error=document.querySelector<HTMLElement>('#auth-error');
    if(error)error.textContent=options.state.sessionMessage;
    return;
  }
  if(!status.user)return;
  options.applyUser(status.user);
  options.startImportMonitor();
  if(!status.enginesConfigured&&location.hash!=='#engine-setup')location.hash='#engine-setup';
  else options.route();
}

interface CompleteOptions extends SessionElements{
  state:SessionState;
  result:AuthenticationResult;
  setup:boolean;
  applyUser:(user:SessionUser)=>void;
  landingHash?:(user:SessionUser)=>string;
}

export function completeAuthentication(options:CompleteOptions){
  options.state.csrf=options.result.csrf;
  options.state.enginesConfigured=options.result.enginesConfigured;
  options.applyUser(options.result.user);
  options.setupView.hidden=true;
  options.authView.hidden=true;
  options.shell.hidden=false;
  location.hash=options.setup?'#engine-setup':options.result.enginesConfigured?(options.landingHash?.(options.result.user)||'#dashboard'):'#engine-setup';
}

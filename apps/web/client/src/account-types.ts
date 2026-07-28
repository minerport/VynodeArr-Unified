export type AccountSection='account'|'sessions'|'users';

export function normalizeAccountSection(
  value:string|undefined,
  administrator:boolean
):AccountSection{
  if(value==='sessions')return'sessions';
  if(value==='users'&&administrator)return'users';
  return'account';
}

export interface AccountUser {
  id:string;
  name:string;
  username:string;
  email:string;
  role:'administrator'|'user';
  permissions?:Record<'dashboard'|'discover'|'movies'|'tv'|'calendar',boolean>;
  enabled?:boolean;
  profileImage?:string;
  timeZone?:string;
  dateTimeFormat?:string;
  theme?:string;
  uiStyle?:'glass'|'solid'|'oled'|'high-contrast';
  uiDensity?:'comfortable'|'compact';
  motionPreference?:'system'|'reduced'|'full';
  language?:string;
}

export interface AccountSession {
  id:string;
  browser:string;
  os:string;
  ipMasked:string;
  lastActivity:string;
  createdAt:string;
  current:boolean;
}

export interface AccountMountOptions {
  section:AccountSection;
  administrator:boolean;
  request:<T=unknown>(path:string,options?:RequestInit)=>Promise<T>;
  notify:(message:string,type?:string)=>void;
  onUserUpdated:(user:AccountUser)=>void;
  onCurrentSessionRevoked:()=>void;
}

export interface AuthUser{id:string;name:string;username:string;email:string;role:string;theme?:string;uiStyle?:string;uiDensity?:string;motionPreference?:string}
export interface AuthResult{csrf:string;enginesConfigured:boolean;user:AuthUser}
export interface AuthenticationMountOptions{request:<T=unknown>(path:string,options?:RequestInit)=>Promise<T>;onAuthenticated:(result:AuthResult,setup:boolean)=>void;sessionMessage:()=>string}

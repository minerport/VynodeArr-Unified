import type {RouteKey} from './routing';

export const userPermissionNames=['dashboard','discover','movies','tv','calendar'] as const;
export type UserPermissionName=typeof userPermissionNames[number];
export type UserPermissions=Record<UserPermissionName,boolean>;

export interface AccessUser{
  role?:string;
  permissions?:Partial<UserPermissions>;
}

const routePermissions:Partial<Record<RouteKey,UserPermissionName>>={
  dashboard:'dashboard',discover:'discover',movies:'movies',movie:'movies',
  tv:'tv',series:'tv',calendar:'calendar'
};

export function hasPageAccess(user:AccessUser|null|undefined,page:UserPermissionName){
  return user?.role==='administrator'||user?.permissions?.[page]===true;
}

export function canOpenRoute(user:AccessUser|null|undefined,key:RouteKey,parts:string[]=[]){
  if(user?.role==='administrator')return true;
  if(key==='settings')return !parts[1]||parts[1]==='account'||parts[1]==='sessions';
  const page=routePermissions[key];
  return Boolean(page&&hasPageAccess(user,page));
}

export function firstPermittedHash(user:AccessUser|null|undefined){
  const first=userPermissionNames.find(page=>hasPageAccess(user,page));
  return first?`#${first}`:'#settings/account';
}

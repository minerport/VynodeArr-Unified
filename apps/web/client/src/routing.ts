export const routeKeys=[
  'dashboard',
  'discover',
  'requests',
  'request-management',
  'operations',
  'movies',
  'tv',
  'collections',
  'lists',
  'add',
  'wanted',
  'movie',
  'series',
  'queue',
  'history',
  'calendar',
  'health',
  'service',
  'management',
  'settings',
  'system',
  'setup',
  'engine-setup'
] as const;

export type RouteKey=typeof routeKeys[number];

export interface AppRoute {
  raw:string;
  requestedKey:string;
  key:RouteKey;
  parts:string[];
}

const knownRouteKeys=new Set<string>(routeKeys);

export function parseRoute(hash:string):AppRoute {
  const raw=hash.replace(/^#/,'')||'dashboard';
  const parts=raw.split('/');
  const requestedKey=parts[0]||'dashboard';
  const key=(knownRouteKeys.has(requestedKey)?requestedKey:'dashboard') as RouteKey;
  return {raw,requestedKey,key,parts};
}

export function preservesMountedLibrary(
  route:AppRoute,
  mounted:{movies:boolean;tv:boolean}
):boolean {
  return ((route.key==='movie'||route.key==='movies')&&mounted.movies)
    ||((route.key==='series'||route.key==='tv')&&mounted.tv);
}

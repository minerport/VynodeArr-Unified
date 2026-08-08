import type {LibraryKind} from './app-state';
import type {AppRoute} from './routing';

export type RouteAction=
  |{name:'redirect';hash:string}
  |{name:'skip'}
  |{name:'engineSetup'}
  |{name:'discover'}
  |{name:'requests'}
  |{name:'requestManagement'}
  |{name:'operations'}
  |{name:'library';kind:LibraryKind}
  |{name:'collections'}
  |{name:'lists'}
  |{name:'addMedia'}
  |{name:'wanted'}
  |{name:'movieDetail';id:string}
  |{name:'tvDetail';id:string}
  |{name:'queue'}
  |{name:'history'}
  |{name:'calendar'}
  |{name:'health'}
  |{name:'serviceSettings';section:string;templateFilter:string}
  |{name:'management'}
  |{name:'engineManagement'}
  |{name:'account';section:string}
  |{name:'system'}
  |{name:'dashboard'};

interface RouteActionState{
  enginesConfigured:boolean;
  preserveLibrary:boolean;
  libraryStale:Record<LibraryKind,boolean>;
}

export function resolveRouteAction(route:AppRoute,state:RouteActionState):RouteAction{
  const {key,parts}=route;
  if(key==='engine-setup'){
    return state.enginesConfigured
      ?{name:'redirect',hash:'#dashboard'}
      :{name:'engineSetup'};
  }
  if(key==='discover')return{name:'discover'};
  if(key==='requests')return{name:'requests'};
  if(key==='request-management')return{name:'requestManagement'};
  if(key==='operations')return{name:'operations'};
  if(key==='movies'||key==='tv'){
    return state.preserveLibrary&&!state.libraryStale[key]
      ?{name:'skip'}
      :{name:'library',kind:key};
  }
  if(key==='collections')return{name:'collections'};
  if(key==='lists')return{name:'lists'};
  if(key==='add')return{name:'addMedia'};
  if(key==='wanted')return{name:'wanted'};
  if(key==='movie')return{name:'movieDetail',id:parts[1]||''};
  if(key==='series')return{name:'tvDetail',id:parts[1]||''};
  if(key==='queue')return{name:'queue'};
  if(key==='history')return{name:'history'};
  if(key==='calendar')return{name:'calendar'};
  if(key==='health')return{name:'health'};
  if(key==='service')return{name:'serviceSettings',section:parts[1]||'',templateFilter:parts[2]||''};
  if(key==='management')return{name:'management'};
  if(key==='settings'){
    return parts[1]==='engines'
      ?{name:'engineManagement'}
      :{name:'account',section:parts[1]||'account'};
  }
  if(key==='system')return{name:'system'};
  return{name:'dashboard'};
}

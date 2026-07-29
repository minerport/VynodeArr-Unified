import {parseRoute,type AppRoute,type RouteKey} from './routing';

interface NavigationBridge{
  unmountDiscover?:()=>void;
  preloadRoute?:(route:RouteKey)=>void;
}

interface NavigationLifecycleOptions{
  window:Window;
  document:Document;
  bridge:()=>NavigationBridge|undefined;
  route:()=>void|Promise<void>;
}

export function shouldResetRouteScroll(previous:AppRoute,next:AppRoute):boolean{
  const returnsToMovieLibrary=previous.key==='movie'&&next.key==='movies';
  const returnsToTvLibrary=previous.key==='series'&&next.key==='tv';
  return !returnsToMovieLibrary&&!returnsToTvLibrary;
}

export function wireNavigationLifecycle(options:NavigationLifecycleOptions):()=>void{
  let activeRoute=parseRoute(options.window.location.hash);
  const onHashChange=()=>{
    const nextRoute=parseRoute(options.window.location.hash);
    options.bridge()?.unmountDiscover?.();
    if(shouldResetRouteScroll(activeRoute,nextRoute)){
      options.window.scrollTo({top:0,left:0,behavior:'instant'});
    }
    activeRoute=nextRoute;
    void options.route();
  };
  const preloadBindings:Array<{
    link:HTMLAnchorElement;
    preload:()=>void;
  }>=[];

  options.window.addEventListener('hashchange',onHashChange);
  for(const link of options.document.querySelectorAll<HTMLAnchorElement>('a[href^="#"]')){
    const preload=()=>options.bridge()?.preloadRoute?.(parseRoute(link.hash).key);
    link.addEventListener('pointerenter',preload,{passive:true});
    link.addEventListener('focus',preload);
    preloadBindings.push({link,preload});
  }
  if('requestIdleCallback'in options.window){
    options.window.requestIdleCallback(()=>{
      options.bridge()?.preloadRoute?.('dashboard');
      options.bridge()?.preloadRoute?.('discover');
    });
  }

  return()=>{
    options.window.removeEventListener('hashchange',onHashChange);
    for(const {link,preload} of preloadBindings){
      link.removeEventListener('pointerenter',preload);
      link.removeEventListener('focus',preload);
    }
  };
}

import {parseRoute,type RouteKey} from './routing';

interface NavigationBridge{
  unmountDiscover?:()=>void;
  preloadRoute?:(route:RouteKey)=>void;
}

interface NavigationLifecycleOptions{
  window:Window;
  document:Document;
  bridge:()=>NavigationBridge|undefined;
  route:()=>void|Promise<void>;
  onDiscoverDetails:(detail:unknown)=>void;
}

export function wireNavigationLifecycle(options:NavigationLifecycleOptions):()=>void{
  const onDiscoverDetails=(event:Event)=>{
    options.onDiscoverDetails((event as CustomEvent<unknown>).detail);
  };
  const onHashChange=()=>{
    options.bridge()?.unmountDiscover?.();
    void options.route();
  };
  const preloadBindings:Array<{
    link:HTMLAnchorElement;
    preload:()=>void;
  }>=[];

  options.window.addEventListener('vynodearr:discover-details',onDiscoverDetails);
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
    options.window.removeEventListener('vynodearr:discover-details',onDiscoverDetails);
    options.window.removeEventListener('hashchange',onHashChange);
    for(const {link,preload} of preloadBindings){
      link.removeEventListener('pointerenter',preload);
      link.removeEventListener('focus',preload);
    }
  };
}

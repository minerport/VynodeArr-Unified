import type { RouteKey } from './routing';

const unmountMethods=[
  'unmountDashboard',
  'unmountDashboardAnalytics',
  'unmountHistory',
  'unmountQueue',
  'unmountRequests',
  'unmountWanted',
  'unmountCalendar',
  'unmountCollections',
  'unmountAddMedia',
  'unmountHealth',
  'unmountMovieDetail',
  'unmountTvDetail',
  'unmountDiscover',
  'unmountAccount',
  'unmountEngineManagement',
  'unmountEngineSetup',
  'unmountDiscoverSettings',
  'unmountQualityProfiles',
  'unmountSystem',
  'unmountSelectionRules',
  'unmountManagement',
  'unmountMediaManagement',
  'unmountRootFolders',
  'unmountProviderSettings',
  'unmountGuideTemplates'
] as const;

type UnmountMethod=typeof unmountMethods[number]|'unmountLibrary';
type RouteBridge=Partial<Record<UnmountMethod,()=>void>>;

export function teardownRoute(
  bridge:RouteBridge|undefined,
  options:{preserveLibrary:boolean;document:Document}
):void {
  for(const method of unmountMethods)bridge?.[method]?.();
  if(!options.preserveLibrary)bridge?.unmountLibrary?.();
  options.document.querySelectorAll('.vynode-detail-modal-host').forEach(host=>host.remove());
}

export function updateNavigation(
  links:Iterable<HTMLAnchorElement>,
  key:RouteKey,
  body:HTMLElement
):void {
  for(const link of links){
    link.classList.toggle(
      'active',
      link.hash.startsWith(`#${key}`)||(key==='settings'&&link.hash==='#settings')
    );
  }
  body.classList.remove('nav-open');
}

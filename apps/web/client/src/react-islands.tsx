import { createRoot,type Root } from 'react-dom/client';
import type { ReactNode } from 'react';
import type { DashboardAnalytics,DashboardMountOptions } from './dashboard-types';
import type { LibraryMountOptions } from './library-types';
import type { HistoryMountOptions } from './history-types';
import type { QueueMountOptions } from './queue-types';
import type { WantedMountOptions } from './wanted-types';
import type { CalendarMountOptions } from './calendar-types';
import type { MovieDetailMountOptions } from './movie-detail-types';
import type { TvDetailMountOptions } from './tv-detail-types';
import type { DiscoverMountOptions } from './discover-types';
import type { MyRequestsMountOptions } from './my-requests-types';
import type { CollectionsMountOptions } from './collection-types';
import type { AddMediaMountOptions } from './add-media-types';
import type { HealthMountOptions } from './health-types';
import type { AccountMountOptions } from './account-types';
import type { SystemMountOptions } from './system-types';
import type { SelectionRulesMountOptions } from './selection-rules-types';
import type { ImportMonitorOptions } from './import-monitor-types';
import type { ManagementMountOptions } from './management-types';
import type { MediaManagementMountOptions } from './media-management-types';
import type { RootFoldersMountOptions } from './root-folders-types';
import type { ProviderSettingsMountOptions } from './provider-settings-types';
import type { GuideTemplatesMountOptions } from './guide-templates-types';
import type { EngineManagementMountOptions } from './engine-management-types';
import type { DiscoverSettingsMountOptions } from './discover-settings-types';
import type { QualityProfilesMountOptions } from './quality-profiles-types';
import type { EngineSetupMountOptions } from './engine-setup-types';
import type { AuthenticationMountOptions } from './authentication-types';
import { RouteErrorBoundary } from './error-boundary';

let dashboardRoot:Root|null=null,dashboardElement:HTMLElement|null=null,fullDashboardRoot:Root|null=null,libraryRoot:Root|null=null,historyRoot:Root|null=null,queueRoot:Root|null=null,wantedRoot:Root|null=null,calendarRoot:Root|null=null,movieDetailRoot:Root|null=null,tvDetailRoot:Root|null=null,discoverRoot:Root|null=null,requestsRoot:Root|null=null,requestManagementRoot:Root|null=null,collectionsRoot:Root|null=null,addMediaRoot:Root|null=null,healthRoot:Root|null=null,accountRoot:Root|null=null,systemRoot:Root|null=null,selectionRulesRoot:Root|null=null,importMonitorRoot:Root|null=null,managementRoot:Root|null=null,mediaManagementRoot:Root|null=null,rootFoldersRoot:Root|null=null,providerSettingsRoot:Root|null=null,guideTemplatesRoot:Root|null=null,engineManagementRoot:Root|null=null,discoverSettingsRoot:Root|null=null,qualityProfilesRoot:Root|null=null,engineSetupRoot:Root|null=null,setupAuthRoot:Root|null=null,signInAuthRoot:Root|null=null;
const loading=(label:string)=><div className="panel skeleton react-route-loading">Loading {label}…</div>;

const guarded=(children:ReactNode)=><RouteErrorBoundary>{children}</RouteErrorBoundary>;
function unmountDashboardAnalytics(){dashboardRoot?.unmount();dashboardRoot=null;dashboardElement=null;}
function mountDashboardAnalytics(element:HTMLElement,analytics:DashboardAnalytics){
  unmountDashboardAnalytics();dashboardElement=element;const root=createRoot(element);dashboardRoot=root;root.render(loading('analytics'));
  void import('./dashboard-analytics').then(({DashboardAnalyticsView})=>{if(dashboardRoot===root)root.render(<DashboardAnalyticsView analytics={analytics}/>);});
}
function unmountDashboard(){fullDashboardRoot?.unmount();fullDashboardRoot=null;}
function mountDashboard(element:HTMLElement,options:DashboardMountOptions){
  unmountDashboard();unmountDashboardAnalytics();const root=createRoot(element);fullDashboardRoot=root;root.render(loading('dashboard'));
  void import('./dashboard').then(({DashboardRoute})=>{if(fullDashboardRoot===root)root.render(guarded(<DashboardRoute options={options}/>));});
}
function unmountLibrary(){libraryRoot?.unmount();libraryRoot=null;}
function mountLibrary(element:HTMLElement,options:LibraryMountOptions){
  unmountLibrary();const root=createRoot(element);libraryRoot=root;root.render(loading(options.kind==='movies'?'movies':'television'));
  void import('./library').then(({LibraryView})=>{if(libraryRoot===root)root.render(<LibraryView options={options}/>);});
}
function unmountHistory(){historyRoot?.unmount();historyRoot=null;}
function mountHistory(element:HTMLElement,options:HistoryMountOptions){
  unmountHistory();const root=createRoot(element);historyRoot=root;root.render(loading('history'));
  void import('./history').then(({HistoryView})=>{if(historyRoot===root)root.render(<HistoryView options={options}/>);});
}
function unmountQueue(){queueRoot?.unmount();queueRoot=null;}
function mountQueue(element:HTMLElement,options:QueueMountOptions){
  unmountQueue();const root=createRoot(element);queueRoot=root;root.render(loading('queue'));
  void import('./queue').then(({QueueView})=>{if(queueRoot===root)root.render(<QueueView options={options}/>);});
}
function unmountRequests(){requestsRoot?.unmount();requestsRoot=null;}
function mountRequests(element:HTMLElement,options:MyRequestsMountOptions){
  unmountRequests();const root=createRoot(element);requestsRoot=root;root.render(loading('requests'));
  void import('./my-requests').then(({MyRequestsView})=>{if(requestsRoot===root)root.render(guarded(<MyRequestsView options={options}/>));});
}
function unmountRequestManagement(){requestManagementRoot?.unmount();requestManagementRoot=null;}
function mountRequestManagement(element:HTMLElement,options:MyRequestsMountOptions){
  unmountRequestManagement();const root=createRoot(element);requestManagementRoot=root;root.render(loading('user requests'));
  void import('./request-management').then(({RequestManagementView})=>{if(requestManagementRoot===root)root.render(guarded(<RequestManagementView options={options}/>));});
}
function unmountWanted(){wantedRoot?.unmount();wantedRoot=null;}
function mountWanted(element:HTMLElement,options:WantedMountOptions){
  unmountWanted();const root=createRoot(element);wantedRoot=root;root.render(loading('wanted media'));
  void import('./wanted').then(({WantedView})=>{if(wantedRoot===root)root.render(<WantedView options={options}/>);});
}
function unmountCalendar(){calendarRoot?.unmount();calendarRoot=null;}
function mountCalendar(element:HTMLElement,options:CalendarMountOptions){
  unmountCalendar();const root=createRoot(element);calendarRoot=root;root.render(loading('calendar'));
  void import('./calendar').then(({CalendarView})=>{if(calendarRoot===root)root.render(<CalendarView options={options}/>);});
}
function unmountMovieDetail(){movieDetailRoot?.unmount();movieDetailRoot=null;}
function mountMovieDetail(element:HTMLElement,options:MovieDetailMountOptions){
  unmountMovieDetail();const root=createRoot(element);movieDetailRoot=root;root.render(loading('movie details'));
  void import('./movie-detail').then(({MovieDetailView})=>{if(movieDetailRoot===root)root.render(<MovieDetailView options={options}/>);});
}
function unmountTvDetail(){tvDetailRoot?.unmount();tvDetailRoot=null;}
function mountTvDetail(element:HTMLElement,options:TvDetailMountOptions){
  unmountTvDetail();const root=createRoot(element);tvDetailRoot=root;root.render(loading('television details'));
  void import('./tv-detail').then(({TvDetailView})=>{if(tvDetailRoot===root)root.render(<TvDetailView options={options}/>);});
}
function unmountDiscover(){discoverRoot?.unmount();discoverRoot=null;}
function mountDiscover(element:HTMLElement,options:DiscoverMountOptions){
  unmountDiscover();const root=createRoot(element);discoverRoot=root;root.render(loading('discover'));
  void import('./discover').then(({DiscoverView})=>{if(discoverRoot===root)root.render(guarded(<DiscoverView options={options}/>));});
}
function unmountCollections(){collectionsRoot?.unmount();collectionsRoot=null;}
function mountCollections(element:HTMLElement,options:CollectionsMountOptions){
  unmountCollections();const root=createRoot(element);collectionsRoot=root;root.render(loading('collections'));
  void import('./collections').then(({CollectionsView})=>{if(collectionsRoot===root)root.render(guarded(<CollectionsView options={options}/>));});
}
function unmountAddMedia(){addMediaRoot?.unmount();addMediaRoot=null;}
function mountAddMedia(element:HTMLElement,options:AddMediaMountOptions){
  unmountAddMedia();const root=createRoot(element);addMediaRoot=root;root.render(loading('media search'));
  void import('./add-media').then(({AddMediaView})=>{if(addMediaRoot===root)root.render(guarded(<AddMediaView options={options}/>));});
}
function unmountHealth(){healthRoot?.unmount();healthRoot=null;}
function mountHealth(element:HTMLElement,options:HealthMountOptions){
  unmountHealth();const root=createRoot(element);healthRoot=root;root.render(loading('health checks'));
  void import('./health').then(({HealthView})=>{if(healthRoot===root)root.render(guarded(<HealthView options={options}/>));});
}
function unmountAccount(){accountRoot?.unmount();accountRoot=null;}
function mountAccount(element:HTMLElement,options:AccountMountOptions){
  unmountAccount();const root=createRoot(element);accountRoot=root;root.render(loading('account settings'));
  void import('./account').then(({AccountView})=>{if(accountRoot===root)root.render(guarded(<AccountView options={options}/>));});
}
function unmountSystem(){systemRoot?.unmount();systemRoot=null;}
function mountSystem(element:HTMLElement,options:SystemMountOptions){
  unmountSystem();const root=createRoot(element);systemRoot=root;root.render(loading('system'));
  void import('./system').then(({SystemView})=>{if(systemRoot===root)root.render(guarded(<SystemView options={options}/>));});
}
function unmountSelectionRules(){selectionRulesRoot?.unmount();selectionRulesRoot=null;}
function mountSelectionRules(element:HTMLElement,options:SelectionRulesMountOptions){
  unmountSelectionRules();const root=createRoot(element);selectionRulesRoot=root;root.render(loading('selection rules'));
  void import('./selection-rules').then(({SelectionRulesView})=>{if(selectionRulesRoot===root)root.render(guarded(<SelectionRulesView options={options}/>));});
}
function unmountImportMonitor(){importMonitorRoot?.unmount();importMonitorRoot=null;}
function mountImportMonitor(element:HTMLElement,options:ImportMonitorOptions){
  unmountImportMonitor();const root=createRoot(element);importMonitorRoot=root;
  void import('./import-monitor').then(({ImportMonitor})=>{if(importMonitorRoot===root)root.render(guarded(<ImportMonitor options={options}/>));});
}
function unmountManagement(){managementRoot?.unmount();managementRoot=null;}
function mountManagement(element:HTMLElement,options:ManagementMountOptions){
  unmountManagement();const root=createRoot(element);managementRoot=root;root.render(loading('advanced settings'));
  void import('./management').then(({ManagementView})=>{if(managementRoot===root)root.render(guarded(<ManagementView options={options}/>));});
}
function unmountMediaManagement(){mediaManagementRoot?.unmount();mediaManagementRoot=null;}
function mountMediaManagement(element:HTMLElement,options:MediaManagementMountOptions){
  unmountMediaManagement();const root=createRoot(element);mediaManagementRoot=root;root.render(loading('media management'));
  void import('./media-management').then(({MediaManagementView})=>{if(mediaManagementRoot===root)root.render(guarded(<MediaManagementView options={options}/>));});
}
function unmountRootFolders(){rootFoldersRoot?.unmount();rootFoldersRoot=null;}
function mountRootFolders(element:HTMLElement,options:RootFoldersMountOptions){
  unmountRootFolders();const root=createRoot(element);rootFoldersRoot=root;root.render(loading('storage folders'));
  void import('./root-folders').then(({RootFoldersView})=>{if(rootFoldersRoot===root)root.render(guarded(<RootFoldersView options={options}/>));});
}
function unmountProviderSettings(){providerSettingsRoot?.unmount();providerSettingsRoot=null;}
function mountProviderSettings(element:HTMLElement,options:ProviderSettingsMountOptions){
  unmountProviderSettings();const root=createRoot(element);providerSettingsRoot=root;root.render(loading(options.kind==='indexers'?'indexers':'download clients'));
  void import('./provider-settings').then(({ProviderSettingsView})=>{if(providerSettingsRoot===root)root.render(guarded(<ProviderSettingsView options={options}/>));});
}
function unmountGuideTemplates(){guideTemplatesRoot?.unmount();guideTemplatesRoot=null;}
function mountGuideTemplates(element:HTMLElement,options:GuideTemplatesMountOptions){
  unmountGuideTemplates();const root=createRoot(element);guideTemplatesRoot=root;root.render(loading('guide templates'));
  void import('./guide-templates').then(({GuideTemplatesView})=>{if(guideTemplatesRoot===root)root.render(guarded(<GuideTemplatesView options={options}/>));});
}
function unmountEngineManagement(){engineManagementRoot?.unmount();engineManagementRoot=null;}
function mountEngineManagement(element:HTMLElement,options:EngineManagementMountOptions){
  unmountEngineManagement();const root=createRoot(element);engineManagementRoot=root;root.render(loading('engine management'));
  void import('./engine-management').then(({EngineManagementView})=>{if(engineManagementRoot===root)root.render(guarded(<EngineManagementView options={options}/>));});
}
function unmountDiscoverSettings(){discoverSettingsRoot?.unmount();discoverSettingsRoot=null;}
function mountDiscoverSettings(element:HTMLElement,options:DiscoverSettingsMountOptions){
  unmountDiscoverSettings();const root=createRoot(element);discoverSettingsRoot=root;root.render(loading('Discover settings'));
  void import('./discover-settings').then(({DiscoverSettingsView})=>{if(discoverSettingsRoot===root)root.render(guarded(<DiscoverSettingsView options={options}/>));});
}
function unmountQualityProfiles(){qualityProfilesRoot?.unmount();qualityProfilesRoot=null;}
function mountQualityProfiles(element:HTMLElement,options:QualityProfilesMountOptions){
  unmountQualityProfiles();const root=createRoot(element);qualityProfilesRoot=root;root.render(loading('quality profiles'));
  void import('./quality-profiles').then(({QualityProfilesView})=>{if(qualityProfilesRoot===root)root.render(guarded(<QualityProfilesView options={options}/>));});
}
function unmountEngineSetup(){engineSetupRoot?.unmount();engineSetupRoot=null;}
function mountEngineSetup(element:HTMLElement,options:EngineSetupMountOptions){
  unmountEngineSetup();const root=createRoot(element);engineSetupRoot=root;root.render(loading('engine setup'));
  void import('./engine-setup').then(({EngineSetupView})=>{if(engineSetupRoot===root)root.render(guarded(<EngineSetupView options={options}/>));});
}
function unmountAuthentication(){setupAuthRoot?.unmount();signInAuthRoot?.unmount();setupAuthRoot=null;signInAuthRoot=null;}
function mountAuthentication(setupElement:HTMLElement,signInElement:HTMLElement,options:AuthenticationMountOptions){
  unmountAuthentication();const setupRoot=createRoot(setupElement),signInRoot=createRoot(signInElement);setupAuthRoot=setupRoot;signInAuthRoot=signInRoot;
  void import('./authentication').then(({SetupView,SignInView})=>{if(setupAuthRoot===setupRoot)setupRoot.render(guarded(<SetupView options={options}/>));if(signInAuthRoot===signInRoot)signInRoot.render(guarded(<SignInView options={options}/>));});
}
const routeImports:Record<string,()=>Promise<unknown>>={
  dashboard:()=>import('./dashboard'),discover:()=>import('./discover'),requests:()=>import('./my-requests'),'request-management':()=>import('./request-management'),collections:()=>import('./collections'),add:()=>import('./add-media'),movies:()=>import('./library'),tv:()=>import('./library'),
  queue:()=>import('./queue'),history:()=>import('./history'),wanted:()=>import('./wanted'),calendar:()=>import('./calendar'),health:()=>import('./health'),
  movie:()=>import('./movie-detail'),series:()=>import('./tv-detail'),settings:()=>Promise.all([import('./account'),import('./engine-management'),import('./engine-setup')]),system:()=>import('./system'),service:()=>Promise.all([import('./selection-rules'),import('./media-management'),import('./root-folders'),import('./provider-settings'),import('./guide-templates'),import('./discover-settings'),import('./quality-profiles')]),management:()=>import('./management'),
};
function preloadRoute(route:string){void routeImports[route]?.();}

declare global {
  interface Window {VynodeArrReact?:{
    mountDashboard:(element:HTMLElement,options:DashboardMountOptions)=>void;unmountDashboard:()=>void;
    mountDashboardAnalytics:(element:HTMLElement,analytics:DashboardAnalytics)=>void;unmountDashboardAnalytics:()=>void;
    mountLibrary:(element:HTMLElement,options:LibraryMountOptions)=>void;unmountLibrary:()=>void;
    mountHistory:(element:HTMLElement,options:HistoryMountOptions)=>void;unmountHistory:()=>void;
    mountQueue:(element:HTMLElement,options:QueueMountOptions)=>void;unmountQueue:()=>void;
    mountRequests:(element:HTMLElement,options:MyRequestsMountOptions)=>void;unmountRequests:()=>void;
    mountRequestManagement:(element:HTMLElement,options:MyRequestsMountOptions)=>void;unmountRequestManagement:()=>void;
    mountWanted:(element:HTMLElement,options:WantedMountOptions)=>void;unmountWanted:()=>void;
    mountCalendar:(element:HTMLElement,options:CalendarMountOptions)=>void;unmountCalendar:()=>void;
    mountMovieDetail:(element:HTMLElement,options:MovieDetailMountOptions)=>void;unmountMovieDetail:()=>void;
    mountTvDetail:(element:HTMLElement,options:TvDetailMountOptions)=>void;unmountTvDetail:()=>void;
    mountDiscover:(element:HTMLElement,options:DiscoverMountOptions)=>void;unmountDiscover:()=>void;
    mountCollections:(element:HTMLElement,options:CollectionsMountOptions)=>void;unmountCollections:()=>void;
    mountAddMedia:(element:HTMLElement,options:AddMediaMountOptions)=>void;unmountAddMedia:()=>void;
    mountHealth:(element:HTMLElement,options:HealthMountOptions)=>void;unmountHealth:()=>void;
    mountAccount:(element:HTMLElement,options:AccountMountOptions)=>void;unmountAccount:()=>void;
    mountSystem:(element:HTMLElement,options:SystemMountOptions)=>void;unmountSystem:()=>void;
    mountSelectionRules:(element:HTMLElement,options:SelectionRulesMountOptions)=>void;unmountSelectionRules:()=>void;
    mountImportMonitor:(element:HTMLElement,options:ImportMonitorOptions)=>void;unmountImportMonitor:()=>void;
    mountManagement:(element:HTMLElement,options:ManagementMountOptions)=>void;unmountManagement:()=>void;
    mountMediaManagement:(element:HTMLElement,options:MediaManagementMountOptions)=>void;unmountMediaManagement:()=>void;
    mountRootFolders:(element:HTMLElement,options:RootFoldersMountOptions)=>void;unmountRootFolders:()=>void;
    mountProviderSettings:(element:HTMLElement,options:ProviderSettingsMountOptions)=>void;unmountProviderSettings:()=>void;
    mountGuideTemplates:(element:HTMLElement,options:GuideTemplatesMountOptions)=>void;unmountGuideTemplates:()=>void;
    mountEngineManagement:(element:HTMLElement,options:EngineManagementMountOptions)=>void;unmountEngineManagement:()=>void;
    mountDiscoverSettings:(element:HTMLElement,options:DiscoverSettingsMountOptions)=>void;unmountDiscoverSettings:()=>void;
    mountQualityProfiles:(element:HTMLElement,options:QualityProfilesMountOptions)=>void;unmountQualityProfiles:()=>void;
    mountEngineSetup:(element:HTMLElement,options:EngineSetupMountOptions)=>void;unmountEngineSetup:()=>void;
    mountAuthentication:(setupElement:HTMLElement,signInElement:HTMLElement,options:AuthenticationMountOptions)=>void;unmountAuthentication:()=>void;
    preloadRoute:(route:string)=>void;
  }}
}
window.VynodeArrReact={mountDashboard,unmountDashboard,mountDashboardAnalytics,unmountDashboardAnalytics,mountLibrary,unmountLibrary,mountHistory,unmountHistory,mountQueue,unmountQueue,mountRequests,unmountRequests,mountRequestManagement,unmountRequestManagement,mountWanted,unmountWanted,mountCalendar,unmountCalendar,mountMovieDetail,unmountMovieDetail,mountTvDetail,unmountTvDetail,mountDiscover,unmountDiscover,mountCollections,unmountCollections,mountAddMedia,unmountAddMedia,mountHealth,unmountHealth,mountAccount,unmountAccount,mountSystem,unmountSystem,mountSelectionRules,unmountSelectionRules,mountImportMonitor,unmountImportMonitor,mountManagement,unmountManagement,mountMediaManagement,unmountMediaManagement,mountRootFolders,unmountRootFolders,mountProviderSettings,unmountProviderSettings,mountGuideTemplates,unmountGuideTemplates,mountEngineManagement,unmountEngineManagement,mountDiscoverSettings,unmountDiscoverSettings,mountQualityProfiles,unmountQualityProfiles,mountEngineSetup,unmountEngineSetup,mountAuthentication,unmountAuthentication,preloadRoute};

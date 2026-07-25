import { createRoot,type Root } from 'react-dom/client';
import type { ReactNode } from 'react';
import type { DashboardAnalytics,DashboardData } from './dashboard-types';
import type { LibraryMountOptions } from './library-types';
import type { HistoryMountOptions } from './history-types';
import type { QueueMountOptions } from './queue-types';
import type { WantedMountOptions } from './wanted-types';
import type { CalendarMountOptions } from './calendar-types';
import type { MovieDetailMountOptions } from './movie-detail-types';
import type { TvDetailMountOptions } from './tv-detail-types';
import type { DiscoverMountOptions } from './discover-types';
import type { CollectionsMountOptions } from './collection-types';
import type { AddMediaMountOptions } from './add-media-types';
import { RouteErrorBoundary } from './error-boundary';

let dashboardRoot:Root|null=null,dashboardElement:HTMLElement|null=null,fullDashboardRoot:Root|null=null,libraryRoot:Root|null=null,historyRoot:Root|null=null,queueRoot:Root|null=null,wantedRoot:Root|null=null,calendarRoot:Root|null=null,movieDetailRoot:Root|null=null,tvDetailRoot:Root|null=null,discoverRoot:Root|null=null,collectionsRoot:Root|null=null,addMediaRoot:Root|null=null;
const loading=(label:string)=><div className="panel skeleton react-route-loading">Loading {label}…</div>;

const guarded=(children:ReactNode)=><RouteErrorBoundary>{children}</RouteErrorBoundary>;
function unmountDashboardAnalytics(){dashboardRoot?.unmount();dashboardRoot=null;dashboardElement=null;}
function mountDashboardAnalytics(element:HTMLElement,analytics:DashboardAnalytics){
  unmountDashboardAnalytics();dashboardElement=element;const root=createRoot(element);dashboardRoot=root;root.render(loading('analytics'));
  void import('./dashboard-analytics').then(({DashboardAnalyticsView})=>{if(dashboardRoot===root)root.render(<DashboardAnalyticsView analytics={analytics}/>);});
}
function unmountDashboard(){fullDashboardRoot?.unmount();fullDashboardRoot=null;}
function mountDashboard(element:HTMLElement,data:DashboardData){
  unmountDashboard();unmountDashboardAnalytics();const root=createRoot(element);fullDashboardRoot=root;root.render(loading('dashboard'));
  void import('./dashboard').then(({DashboardView})=>{if(fullDashboardRoot===root)root.render(guarded(<DashboardView data={data}/>));});
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
const routeImports:Record<string,()=>Promise<unknown>>={
  dashboard:()=>import('./dashboard'),discover:()=>import('./discover'),collections:()=>import('./collections'),add:()=>import('./add-media'),movies:()=>import('./library'),tv:()=>import('./library'),
  queue:()=>import('./queue'),history:()=>import('./history'),wanted:()=>import('./wanted'),calendar:()=>import('./calendar'),
  movie:()=>import('./movie-detail'),series:()=>import('./tv-detail'),
};
function preloadRoute(route:string){void routeImports[route]?.();}

declare global {
  interface Window {VynodeArrReact?:{
    mountDashboard:(element:HTMLElement,data:DashboardData)=>void;unmountDashboard:()=>void;
    mountDashboardAnalytics:(element:HTMLElement,analytics:DashboardAnalytics)=>void;unmountDashboardAnalytics:()=>void;
    mountLibrary:(element:HTMLElement,options:LibraryMountOptions)=>void;unmountLibrary:()=>void;
    mountHistory:(element:HTMLElement,options:HistoryMountOptions)=>void;unmountHistory:()=>void;
    mountQueue:(element:HTMLElement,options:QueueMountOptions)=>void;unmountQueue:()=>void;
    mountWanted:(element:HTMLElement,options:WantedMountOptions)=>void;unmountWanted:()=>void;
    mountCalendar:(element:HTMLElement,options:CalendarMountOptions)=>void;unmountCalendar:()=>void;
    mountMovieDetail:(element:HTMLElement,options:MovieDetailMountOptions)=>void;unmountMovieDetail:()=>void;
    mountTvDetail:(element:HTMLElement,options:TvDetailMountOptions)=>void;unmountTvDetail:()=>void;
    mountDiscover:(element:HTMLElement,options:DiscoverMountOptions)=>void;unmountDiscover:()=>void;
    mountCollections:(element:HTMLElement,options:CollectionsMountOptions)=>void;unmountCollections:()=>void;
    mountAddMedia:(element:HTMLElement,options:AddMediaMountOptions)=>void;unmountAddMedia:()=>void;
    preloadRoute:(route:string)=>void;
  }}
}
window.VynodeArrReact={mountDashboard,unmountDashboard,mountDashboardAnalytics,unmountDashboardAnalytics,mountLibrary,unmountLibrary,mountHistory,unmountHistory,mountQueue,unmountQueue,mountWanted,unmountWanted,mountCalendar,unmountCalendar,mountMovieDetail,unmountMovieDetail,mountTvDetail,unmountTvDetail,mountDiscover,unmountDiscover,mountCollections,unmountCollections,mountAddMedia,unmountAddMedia,preloadRoute};

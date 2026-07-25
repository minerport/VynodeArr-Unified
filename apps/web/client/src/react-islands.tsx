import { createRoot,type Root } from 'react-dom/client';
import { DashboardAnalyticsView } from './dashboard-analytics';
import { DashboardView } from './dashboard';
import type { DashboardAnalytics,DashboardData } from './dashboard-types';
import { LibraryView } from './library';
import type { LibraryMountOptions } from './library-types';
import { HistoryView } from './history';
import type { HistoryMountOptions } from './history-types';
import { QueueView } from './queue';
import type { QueueMountOptions } from './queue-types';
import { WantedView } from './wanted';
import type { WantedMountOptions } from './wanted-types';
import { CalendarView } from './calendar';
import type { CalendarMountOptions } from './calendar-types';
import { MovieDetailView } from './movie-detail';
import type { MovieDetailMountOptions } from './movie-detail-types';
import { TvDetailView } from './tv-detail';
import type { TvDetailMountOptions } from './tv-detail-types';

let dashboardRoot:Root|null=null;
let dashboardElement:HTMLElement|null=null;
let fullDashboardRoot:Root|null=null;
let libraryRoot:Root|null=null;
let historyRoot:Root|null=null;
let queueRoot:Root|null=null;
let wantedRoot:Root|null=null;
let calendarRoot:Root|null=null;
let movieDetailRoot:Root|null=null;
let tvDetailRoot:Root|null=null;

function unmountDashboardAnalytics(){
  dashboardRoot?.unmount();
  dashboardRoot=null;
  dashboardElement=null;
}

function mountDashboardAnalytics(element:HTMLElement,analytics:DashboardAnalytics){
  unmountDashboardAnalytics();
  dashboardElement=element;
  dashboardRoot=createRoot(element);
  dashboardRoot.render(<DashboardAnalyticsView analytics={analytics}/>);
}

function unmountDashboard(){
  fullDashboardRoot?.unmount();
  fullDashboardRoot=null;
}

function mountDashboard(element:HTMLElement,data:DashboardData){
  unmountDashboard();
  unmountDashboardAnalytics();
  fullDashboardRoot=createRoot(element);
  fullDashboardRoot.render(<DashboardView data={data}/>);
}

function unmountLibrary(){libraryRoot?.unmount();libraryRoot=null;}
function mountLibrary(element:HTMLElement,options:LibraryMountOptions){
  unmountLibrary();
  libraryRoot=createRoot(element);
  libraryRoot.render(<LibraryView options={options}/>);
}
function unmountHistory(){historyRoot?.unmount();historyRoot=null;}
function mountHistory(element:HTMLElement,options:HistoryMountOptions){
  unmountHistory();
  historyRoot=createRoot(element);
  historyRoot.render(<HistoryView options={options}/>);
}
function unmountQueue(){queueRoot?.unmount();queueRoot=null;}
function mountQueue(element:HTMLElement,options:QueueMountOptions){
  unmountQueue();
  queueRoot=createRoot(element);
  queueRoot.render(<QueueView options={options}/>);
}
function unmountWanted(){wantedRoot?.unmount();wantedRoot=null;}
function mountWanted(element:HTMLElement,options:WantedMountOptions){
  unmountWanted();
  wantedRoot=createRoot(element);
  wantedRoot.render(<WantedView options={options}/>);
}
function unmountCalendar(){calendarRoot?.unmount();calendarRoot=null;}
function mountCalendar(element:HTMLElement,options:CalendarMountOptions){
  unmountCalendar();
  calendarRoot=createRoot(element);
  calendarRoot.render(<CalendarView options={options}/>);
}
function unmountMovieDetail(){movieDetailRoot?.unmount();movieDetailRoot=null;}
function mountMovieDetail(element:HTMLElement,options:MovieDetailMountOptions){
  unmountMovieDetail();
  movieDetailRoot=createRoot(element);
  movieDetailRoot.render(<MovieDetailView options={options}/>);
}
function unmountTvDetail(){tvDetailRoot?.unmount();tvDetailRoot=null;}
function mountTvDetail(element:HTMLElement,options:TvDetailMountOptions){
  unmountTvDetail();
  tvDetailRoot=createRoot(element);
  tvDetailRoot.render(<TvDetailView options={options}/>);
}

declare global {
  interface Window {
    VynodeArrReact?:{
      mountDashboard:(element:HTMLElement,data:DashboardData)=>void;
      unmountDashboard:()=>void;
      mountDashboardAnalytics:(element:HTMLElement,analytics:DashboardAnalytics)=>void;
      unmountDashboardAnalytics:()=>void;
      mountLibrary:(element:HTMLElement,options:LibraryMountOptions)=>void;
      unmountLibrary:()=>void;
      mountHistory:(element:HTMLElement,options:HistoryMountOptions)=>void;
      unmountHistory:()=>void;
      mountQueue:(element:HTMLElement,options:QueueMountOptions)=>void;
      unmountQueue:()=>void;
      mountWanted:(element:HTMLElement,options:WantedMountOptions)=>void;
      unmountWanted:()=>void;
      mountCalendar:(element:HTMLElement,options:CalendarMountOptions)=>void;
      unmountCalendar:()=>void;
      mountMovieDetail:(element:HTMLElement,options:MovieDetailMountOptions)=>void;
      unmountMovieDetail:()=>void;
      mountTvDetail:(element:HTMLElement,options:TvDetailMountOptions)=>void;
      unmountTvDetail:()=>void;
    };
  }
}

window.VynodeArrReact={mountDashboard,unmountDashboard,mountDashboardAnalytics,unmountDashboardAnalytics,mountLibrary,unmountLibrary,mountHistory,unmountHistory,mountQueue,unmountQueue,mountWanted,unmountWanted,mountCalendar,unmountCalendar,mountMovieDetail,unmountMovieDetail,mountTvDetail,unmountTvDetail};

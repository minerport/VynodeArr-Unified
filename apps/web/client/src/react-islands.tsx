import { createRoot,type Root } from 'react-dom/client';
import { DashboardAnalyticsView } from './dashboard-analytics';
import { DashboardView } from './dashboard';
import type { DashboardAnalytics,DashboardData } from './dashboard-types';
import { LibraryView } from './library';
import type { LibraryMountOptions } from './library-types';

let dashboardRoot:Root|null=null;
let dashboardElement:HTMLElement|null=null;
let fullDashboardRoot:Root|null=null;
let libraryRoot:Root|null=null;

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

declare global {
  interface Window {
    VynodeArrReact?:{
      mountDashboard:(element:HTMLElement,data:DashboardData)=>void;
      unmountDashboard:()=>void;
      mountDashboardAnalytics:(element:HTMLElement,analytics:DashboardAnalytics)=>void;
      unmountDashboardAnalytics:()=>void;
      mountLibrary:(element:HTMLElement,options:LibraryMountOptions)=>void;
      unmountLibrary:()=>void;
    };
  }
}

window.VynodeArrReact={mountDashboard,unmountDashboard,mountDashboardAnalytics,unmountDashboardAnalytics,mountLibrary,unmountLibrary};

import { createRoot,type Root } from 'react-dom/client';
import { DashboardAnalyticsView } from './dashboard-analytics';
import { DashboardView } from './dashboard';
import type { DashboardAnalytics,DashboardData } from './dashboard-types';

let dashboardRoot:Root|null=null;
let dashboardElement:HTMLElement|null=null;
let fullDashboardRoot:Root|null=null;

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

declare global {
  interface Window {
    VynodeArrReact?:{
      mountDashboard:(element:HTMLElement,data:DashboardData)=>void;
      unmountDashboard:()=>void;
      mountDashboardAnalytics:(element:HTMLElement,analytics:DashboardAnalytics)=>void;
      unmountDashboardAnalytics:()=>void;
    };
  }
}

window.VynodeArrReact={mountDashboard,unmountDashboard,mountDashboardAnalytics,unmountDashboardAnalytics};

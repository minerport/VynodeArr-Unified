export type Domain='movie'|'tv';

export interface TrendPoint {
  date:string;
  count:number;
}

export interface DistributionItem {
  name:string;
  count:number;
}

export interface ActivityStats {
  completed:number;
  grabbed:number;
  failed:number;
}

export interface MovieLibraryStats {
  total:number;
  available:number;
  missing:number;
  belowCutoff:number;
  sizeOnDisk:number;
}

export interface TelevisionLibraryStats {
  total:number;
  complete:number;
  needsAttention:number;
  episodesMissing:number;
  sizeOnDisk:number;
}

export interface DashboardAnalytics {
  rangeDays:number;
  activity:Record<Domain,ActivityStats>;
  downloadsOverTime:Record<Domain,TrendPoint[]>;
  qualityDistribution:Record<Domain,DistributionItem[]>;
  library:{
    movie:MovieLibraryStats;
    tv:TelevisionLibraryStats;
  };
}

export interface DashboardMetrics {
  movies:number;
  tv:number;
  queue:number;
  upcomingMovies:number;
  upcomingEpisodes:number;
  missing:number;
  downloading:number;
  health:number;
  storage:string|number;
}

export interface RecentlyAddedItem {
  id?:string|number;
  title?:string;
  year?:number;
  type?:string;
  timestamp?:string;
  engineInstanceId?:string|null;
  engineInstanceName?:string|null;
}

export interface RecentActivityItem {
  id?:string|number;
  title?:string;
  eventType?:string;
  status?:string;
  dateUtc?:string;
  timestamp?:string;
  eta?:string;
  engineInstanceId?:string|null;
  engineInstanceName?:string|null;
}

export interface UpcomingItem {
  id?:string|number;
  domain:'movie'|'tv';
  title?:string;
  context?:string|null;
  dateUtc?:string;
  mediaId?:string|null;
}

export interface DashboardData {
  metrics:DashboardMetrics;
  upcoming?:UpcomingItem[];
  analytics?:DashboardAnalytics;
  recentlyAdded?:RecentlyAddedItem[];
  recentActivity?:RecentActivityItem[];
  scope?:{
    movie:{id:string;name:string;instanceCount:number};
    tv:{id:string;name:string;instanceCount:number};
  };
  engines?:{
    configured?:boolean;
    mode?:string;
    status?:Record<Domain,{status?:string;lastSuccess?:string|null;safeError?:string|null;itemCount?:number}>;
  };
}

export interface DashboardMountOptions {
  request:<T=unknown>(path:string,options?:RequestInit)=>Promise<T>;
}

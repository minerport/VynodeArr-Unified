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
}

export interface RecentActivityItem {
  id?:string|number;
  title?:string;
  eventType?:string;
  status?:string;
  dateUtc?:string;
  timestamp?:string;
  eta?:string;
}

export interface DashboardData {
  metrics:DashboardMetrics;
  analytics?:DashboardAnalytics;
  recentlyAdded?:RecentlyAddedItem[];
  recentActivity?:RecentActivityItem[];
}

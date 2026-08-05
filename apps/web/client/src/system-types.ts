export type SystemDomain = "movie" | "tv";
export type SystemView =
  | "status"
  | "performance"
  | "validation"
  | "tasks"
  | "backups"
  | "updates"
  | "security"
  | "events"
  | "audit";
export interface PerformanceSettings {
  pageSize: number;
  eventConcurrency: number;
  artworkFetchConcurrency: number;
  artworkWriteConcurrency: number;
  integrityIntervalMinutes: number;
  updatedAt?: string | null;
}
export interface PerformanceReport {
  generatedAt: string;
  process: {
    uptimeSeconds: number;
    rss: number;
    heapUsed: number;
    heapTotal: number;
  };
  catalog: {
    movie?: number;
    tv?: number;
    events?: {
      active: number;
      concurrency: number;
      queue: Record<string, number>;
    } | null;
  };
  artwork: {
    memory?: { items: number; bytes: number; evictions: number };
    disk?: { items: number; bytes: number } | null;
    inFlight: number;
    fetch: { active: number; queued: number; limit: number };
    write: { active: number; queued: number; limit: number };
  };
  requests: { path: string; count: number; averageMs: number; maxMs: number }[];
  settings: PerformanceSettings;
}

export interface DiskSpace {
  path: string;
  freeSpace: number;
  totalSpace: number;
}
export interface SystemRecord {
  id?: string | number;
  domain: SystemDomain;
  name?: string;
  taskName?: string;
  interval?: number;
  lastExecution?: string;
  nextExecution?: string;
  time?: string;
  type?: string;
  size?: number;
  level?: string;
  message?: string;
  exception?: string;
}
export interface ApplicationUpdate {
  installedVersion: string;
  channel: string;
  mechanism: string;
  repository: string;
  message: string;
}
export interface EngineUpdateCandidate {
  domain: SystemDomain;
  name: string;
  installedVersion: string;
  latestVersion?: string;
  updateAvailable?: boolean;
  publishedAt?: string | null;
  releaseUrl?: string;
  repository?: string;
  prerelease?: boolean;
  draft?: boolean;
  unavailable?: boolean;
  message?: string;
  asset?: { name: string; size: number; url: string } | null;
}
export interface EngineUpdateCatalog {
  generatedAt: string;
  mechanism: string;
  engines: EngineUpdateCandidate[];
}
export interface EngineUpdateReview {
  generatedAt: string;
  domain: SystemDomain;
  outcome: "ready" | "review" | "blocked";
  candidate: EngineUpdateCandidate;
  applicationMode: "review-only";
  nextAction: string;
  checks: {
    id: string;
    status: "passed" | "warning" | "failed";
    title: string;
    message: string;
  }[];
  issueDraft?: { title: string; body: string; url: string };
}
export interface EngineCandidatePlan {
  preparedAt: string;
  workflowUrl: string;
  workflowInputs: {
    base_ref: string;
    movie_version: string;
    tv_version: string;
    confirmation: string;
  };
  candidateTag: string;
  rollbackImage: string;
  instructions: string[];
}
export interface MasterKeyStatus {
  managed: boolean;
  source: string;
  canRotate: boolean;
  storage: string;
}
export interface ApplicationBackupSummary {
  fileName: string;
  createdAt: string;
  applicationVersion: string;
  fileCount: number;
  masterKeyManaged: boolean;
  groups: Record<
    | "identity"
    | "credentials"
    | "masterKey"
    | "notifications"
    | "requests"
    | "collections"
    | "history"
    | "audit",
    boolean
  >;
  warnings: string[];
}
export type ValidationStatus = "healthy" | "warning" | "failed";
export interface ValidationCheck {
  id: string;
  group: string;
  title: string;
  status: ValidationStatus;
  message: string;
  details?: string[];
  action?: {
    label: string;
    href?: string;
    repair?: "synchronize" | "engine-connections";
  };
}
export interface ValidationReport {
  generatedAt: string;
  applicationVersion: string;
  overall: ValidationStatus;
  summary: { healthy: number; warning: number; failed: number };
  checks: ValidationCheck[];
}
export interface AuditEntry {
  id: string;
  timestamp: string;
  userId: string;
  username: string;
  actorName?: string;
  category?: string;
  action?: string;
  target?: string;
  summary?: string;
  domain?: SystemDomain | null;
  resource?: string;
  method?: string;
  resourceId?: string | number | null;
  metadata?: Record<string, unknown>;
}
export interface SystemMountOptions {
  request: <T = unknown>(path: string, options?: RequestInit) => Promise<T>;
  notify: (message: string, type?: string) => void;
}

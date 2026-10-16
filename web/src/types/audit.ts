export interface SystemAuditLog {
  id: string;
  correlationId: string | null;
  actorId: string | null;
  actorEmail: string | null;
  actorRole: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  outcome: string;
  reason: string | null;
  detailsJson: string | null;
  beforeStateJson: string | null;
  afterStateJson: string | null;
  ipAddress: string | null;
  timestamp: string;
}

export interface AuditLogQuery {
  action?: string;
  resourceType?: string;
  resourceId?: string;
  actor?: string;
  outcome?: string;
  correlationId?: string;
  search?: string;
  fromUtc?: string;
  toUtc?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

export interface AuditStatsResponse {
  totalEvents: number;
  securityDenials: number;
  mutationsCount: number;
  shortageWorkflowEvents: number;
  aiCoordinatorEvents: number;
  lastEventAt: string;
}

/**
 * Demand & Shortage types, mirroring the frozen API contract.
 * Sathurstiga S. (IT24103156).
 */

/** Standard success envelope. Shared contract - owner: ILHAM MM (IT24103530). */
export interface ApiResponse<T> {
  success: boolean;
  data: T;
}

/** Standard paged payload: ?page=1&pageSize=20 */
export interface PagedResponse<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}

/** Standard error payload. Shared contract - owner: Arudkumaran V. (IT24103011). */
export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    traceId: string;
  };
}

export interface ConsumptionRecord {
  id: string;
  facilityId: string;
  medicineId: string;
  quantityUsed: number;
  consumptionDate: string;
  source: string;
  notes: string | null;
  createdAt: string;
}

/** The deterministic forecasting methods sanctioned by the blueprint. */
export type ForecastMethod = 'MOVING_AVERAGE' | 'WEIGHTED_MOVING_AVERAGE' | 'SIMPLE_TREND';

export const FORECAST_METHODS: ForecastMethod[] = [
  'MOVING_AVERAGE',
  'WEIGHTED_MOVING_AVERAGE',
  'SIMPLE_TREND',
];

export interface DemandForecast {
  id: string;
  facilityId: string;
  medicineId: string;
  forecastDate: string;
  predictedDemand: number;
  averageDailyConsumption: number;
  method: ForecastMethod;
  windowDays: number;
  horizonDays: number;
  confidenceScore: number;
  leadTimeDays: number;
  generatedAt: string;
  status: string;
}

export type ShortageRiskLevel = 'HIGH' | 'MEDIUM';

/**
 * Shortage alert lifecycle.
 *
 * Not specified in the final blueprint: only OPEN appears in the blueprint example.
 * ACKNOWLEDGED and RESOLVED support the shortage management screen.
 */
export type ShortageStatus = 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED';

export const SHORTAGE_STATUSES: ShortageStatus[] = ['OPEN', 'ACKNOWLEDGED', 'RESOLVED'];

export interface ShortageAlert {
  id: string;
  facilityId: string;
  medicineId: string;
  demandForecastId: string | null;
  currentStock: number;
  averageDailyConsumption: number;
  /** Null when nothing is being consumed, so no stockout is projected. */
  daysRemaining: number | null;
  projectedStockoutDate: string | null;
  leadTimeDays: number;
  riskLevel: ShortageRiskLevel;
  requiresTransfer: boolean;
  generatedAt: string;
  status: string;
}

/** Body of POST and PUT /api/consumption. */
export interface ConsumptionRequest {
  facilityId: string;
  medicineId: string;
  quantityUsed: number;
  /** ISO 8601 date the medicine was consumed. */
  consumptionDate: string;
  source: string;
  notes?: string | null;
}

export interface ConsumptionQuery {
  facilityId?: string;
  medicineId?: string;
  fromDate?: string;
  toDate?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

export interface ForecastQuery {
  facilityId?: string;
  medicineId?: string;
  status?: string;
  method?: ForecastMethod;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

export interface ShortageQuery {
  facilityId?: string;
  medicineId?: string;
  status?: string;
  riskLevel?: ShortageRiskLevel;
  requiresTransfer?: boolean;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

export interface ForecastRequest {
  facilityId: string;
  medicineId: string;
  windowDays?: number;
  horizonDays?: number;
  method?: ForecastMethod;
  leadTimeDays?: number;
}

export interface ShortageRecalculateRequest {
  facilityId: string;
  medicineId: string;
  currentStock: number;
  averageDailyConsumption?: number;
  leadTimeDays?: number;
  windowDays?: number;
}

/** Body of POST /api/shortages — raise an alert directly. */
export interface ShortageCreateRequest {
  facilityId: string;
  medicineId: string;
  currentStock: number;
  averageDailyConsumption?: number;
  leadTimeDays?: number;
  windowDays?: number;
}

/**
 * Body of PUT /api/shortages/{id}.
 *
 * Only status, stock and lead time are settable. The derived figures — days of cover,
 * projected stockout, risk level — are recalculated by the backend and can never be
 * supplied by the client.
 */
export interface ShortageUpdateRequest {
  status?: ShortageStatus;
  currentStock?: number;
  leadTimeDays?: number;
}

// ---------------------------------------------------------------------------
// Agentic AI
// ---------------------------------------------------------------------------

/** One numeric or narrative observation the agent made. */
export interface AgentFinding {
  code: string;
  summary: string;
  value: number | null;
  unit: string | null;
}

/** An operational suggestion. Advisory only - the agent approves nothing. */
export interface AgentRecommendation {
  code: string;
  summary: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
}

/** Which tool produced which value, so every number is traceable. */
export interface AgentEvidence {
  source: string;
  detail: string;
  value: unknown;
}

/** Agent output contract (blueprint section 73). */
export interface AgentResult {
  agent: string;
  status: 'SUCCESS' | 'SAFE_FAILURE';
  confidence: number;
  findings: AgentFinding[];
  recommendations: AgentRecommendation[];
  requiredValidation: boolean;
  requestedAction: string | null;
  evidence: AgentEvidence[];
}

/** Envelope from POST /api/demand/agent/analyze. */
export interface AgentRunResult {
  intent: string;
  plan: string[];
  handledBy: string | null;
  result: AgentResult | null;
  durationMs: number;
}

export interface AgentAnalyzeRequest {
  facilityId: string;
  medicineId: string;
  objective?: string;
  currentStock?: number;
  windowDays?: number;
}

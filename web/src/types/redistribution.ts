export type TransferStatus =
  | 'Draft'
  | 'Proposed'
  | 'Requested'
  | 'Approved'
  | 'Reserved'
  | 'InTransit'
  | 'Delivered'
  | 'Cancelled'
  | 'Rejected';

export type TransferPriority = 'Routine' | 'Urgent' | 'Emergency';

export interface TransferStatusHistoryDto {
  id: string;
  fromStatus: string;
  toStatus: string;
  changedByUserId: string;
  reason: string;
  changedAt: string;
}

export interface TransferDto {
  id: string;
  transferNumber: string;
  sourceFacilityId: string;
  sourceFacilityName: string;
  destinationFacilityId: string;
  destinationFacilityName: string;
  medicineId: string;
  medicineName: string;
  medicineBatchNumber: string;
  requestedQuantity: number;
  allocatedQuantity: number;
  status: TransferStatus;
  priority: TransferPriority;
  distanceKm: number;
  estimatedDurationMinutes: number;
  notes: string;
  requestedAt: string;
  approvedAt: string | null;
  reservedAt: string | null;
  dispatchedAt: string | null;
  deliveredAt: string | null;
  workflowRunId?: string | null;
  items?: Array<{
    id?: string;
    medicineId: string;
    medicineName: string;
    requestedQuantity: number;
    allocatedQuantity: number;
    receivedQuantity?: number | null;
    unitOfMeasure?: string;
    batchNumber?: string | null;
  }>;
  statusHistories?: TransferStatusHistoryDto[];
}

export interface CandidateFacilityDto {
  facilityId: string;
  facilityName: string;
  city: string;
  latitude: number;
  longitude: number;
  stockOnHand: number;
  safetyStock: number;
  reservedStock: number;
  availableSurplus: number;
  distanceKm: number;
  estimatedDurationMinutes: number;
  routingProvider: string;
  score: number;
}

export interface RouteWaypoint {
  latitude: number;
  longitude: number;
  label: string;
}

export interface RouteDetailsDto {
  sourceFacilityId: string;
  sourceFacilityName: string;
  destinationFacilityId: string;
  destinationFacilityName: string;
  distanceKm: number;
  durationMinutes: number;
  provider: string;
  isFallback: boolean;
  geometryGeoJson: string | null;
  waypoints: RouteWaypoint[];
}

export interface CreateTransferRequest {
  destinationFacilityId: string;
  medicineId: string;
  requestedQuantity: number;
  priority: TransferPriority;
  notes?: string;
  sourceFacilityId?: string;
}

export interface ReserveStockRequest {
  transferId: string;
  sourceFacilityId: string;
  medicineId: string;
  quantityToReserve: number;
  notes?: string;
}

export interface ReceiveTransferRequest {
  transferId: string;
  receivedQuantity: number;
  batchNumber: string;
  destinationFacilityId: string;
  discrepancyReason?: string;
  notes?: string;
}

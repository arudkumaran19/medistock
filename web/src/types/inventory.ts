export type Inventory = { id: string; medicineId: string; medicineName: string; facilityId: string; facilityName: string; quantityOnHand: number; quantityReserved: number; availableQuantity: number; minimumStockLevel: number; isBelowMinimum: boolean; isMedicineActive: boolean };
export type Medicine = { id: string; code: string; name: string; unit: string; minimumStockLevel: number; isActive: boolean };
export type Batch = { id: string; medicineId: string; medicineName: string; facilityId: string; batchNumber: string; quantityOnHand: number; expiryDateUtc: string; manufacturingDateUtc: string };
export type Facility = { id: string; code: string; name: string; address: string; isActive: boolean };
export type StockTransaction = { id: string; createdAtUtc: string; type: string; quantity: number; reason: string; balanceAfter: number; batchNumber: string | null };

const medicineCodePattern = /^[A-Za-z0-9]+-\d{3}$/;
const batchNumberPattern = /^BATCH-\d{3}$/;

export function validateMedicineCode(value: string): string | undefined {
  const normalized = value.trim();
  if (!normalized) return "Medicine code is required.";
  if (!medicineCodePattern.test(normalized)) return "Medicine code must follow the format MEDICINE-###, for example PARA-500.";
}

export function validateMedicineName(value: string): string | undefined {
  if (!value.trim()) return "Medicine name is required.";
  if (value.trim().length > 200) return "Medicine name must be 200 characters or fewer.";
}

export function validateUnit(value: string): string | undefined {
  const normalized = value.trim();
  if (!normalized) return "Unit is required.";
  if (normalized.length > 30 || !/\p{L}/u.test(normalized)) return "Unit must contain text such as tablet, capsule, bottle, or box (max 30 characters).";
}

export function validateMinimumStock(value: string): string | undefined {
  const parsed = Number(value);
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(parsed) || parsed > 2_147_483_647) return "Minimum stock must be a non-negative whole number.";
}

export function validateBatchNumber(value: string): string | undefined {
  const normalized = value.trim();
  if (!normalized) return "Batch number must follow the format BATCH-###, for example BATCH-001.";
  if (!batchNumberPattern.test(normalized)) return "Batch number must follow the format BATCH-###, for example BATCH-001.";
}

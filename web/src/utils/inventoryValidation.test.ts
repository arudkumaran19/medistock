import { describe, expect, it } from "vitest";
import { validateBatchNumber, validateMedicineCode, validateMinimumStock, validateUnit } from "./inventoryValidation";

describe("Member 1 inventory validation", () => {
  it.each(["BATCH-001", "BATCH-002", "BATCH-123"])("accepts valid batch number %s", value => {
    expect(validateBatchNumber(value)).toBeUndefined();
  });

  it.each(["ABC345", "ABC 123", "--ABC 124", "-ABC123", "@@@", "", "   ", "-1", "BATCH-1", "BATCH-01", "BATCH-1234", "BATCH-ABC", "batch-001", "A".repeat(51)])("rejects invalid batch number %j", value => {
    expect(validateBatchNumber(value)).toBeTruthy();
  });

  it.each(["PARA-500", "AMOX-250", "VITC-001", "IBU-200"])("accepts valid medicine code %s", value => {
    expect(validateMedicineCode(value)).toBeUndefined();
  });

  it.each(["PARA500", "PARA 500", "PARA@500", "-PARA-500", "PARA-50", "PARA-5000", "", "   "])("rejects invalid medicine code %j", value => {
    expect(validateMedicineCode(value)).toBeTruthy();
  });

  it.each(["tablet", "capsule", "bottle", "vial", "box", "strip"])("accepts textual unit %s", value => {
    expect(validateUnit(value)).toBeUndefined();
  });

  it.each(["123", "50", "3.5", "@@@", "---", "", "   "])("rejects invalid unit %j", value => {
    expect(validateUnit(value)).toBeTruthy();
  });

  it.each(["10", "0"])("accepts nonnegative integer minimum stock %s", value => {
    expect(validateMinimumStock(value)).toBeUndefined();
  });

  it.each(["-5", "3.5", "abc", "", "  ", "2147483648"])("rejects invalid minimum stock %j", value => {
    expect(validateMinimumStock(value)).toBeTruthy();
  });
});

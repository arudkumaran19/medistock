import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { ReceiveStockPage } from "./ReceiveStockPage";

const { mockMedicines, mockFacilities, mockReceive } = vi.hoisted(() => ({
  mockMedicines: vi.fn(),
  mockFacilities: vi.fn(),
  mockReceive: vi.fn(),
}));

vi.mock("../services/inventoryApi", () => ({
  inventoryApi: { medicines: mockMedicines, facilities: mockFacilities, receive: mockReceive },
}));

function renderReceivePage() {
  return render(<MemoryRouter><ReceiveStockPage /></MemoryRouter>);
}

describe("ReceiveStockPage batch validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMedicines.mockResolvedValue([{ id: "medicine-1", name: "Vitamin C", code: "VITC-DEMO", unit: "tablet", minimumStockLevel: 10, isActive: true }]);
    mockFacilities.mockResolvedValue([{ id: "facility-1", name: "Central Facility", code: "CENTRAL", isActive: true }]);
    mockReceive.mockResolvedValue({});
  });

  it.each(["ABC345", "ABC 123", "--ABC 124", "-ABC123", "@@@", "", " ", "-1", "BATCH-1", "BATCH-1234", "BATCH-ABC", "batch-001", "A".repeat(51)])("shows an error and blocks the API for invalid batch %j", async batchNumber => {
    renderReceivePage();
    const input = await screen.findByLabelText("Batch number");
    fireEvent.change(input, { target: { value: batchNumber } });
    fireEvent.blur(input);
    expect(await screen.findByRole("alert")).toHaveTextContent("Batch number must follow the format BATCH-###, for example BATCH-001.");
    fireEvent.click(screen.getByRole("button", { name: "Record receipt" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/Batch number/);
    expect(mockReceive).not.toHaveBeenCalled();
  });

  it.each(["BATCH-001", "BATCH-002", "BATCH-123"])("submits valid batch %s", async batchNumber => {
    renderReceivePage();
    fireEvent.change(await screen.findByLabelText("Batch number"), { target: { value: batchNumber } });
    fireEvent.change(screen.getByLabelText("manufacturingDate"), { target: { value: "2025-01-01" } });
    fireEvent.change(screen.getByLabelText("expiryDate"), { target: { value: "2026-01-01" } });
    fireEvent.click(screen.getByRole("button", { name: "Record receipt" }));
    await waitFor(() => expect(mockReceive).toHaveBeenCalledTimes(1));
    expect(mockReceive.mock.calls[0][0].batchNumber).toBe(batchNumber);
  });
});

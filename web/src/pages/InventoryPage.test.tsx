import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { InventoryPage } from "./InventoryPage";

const { mockList, mockMedicines, mockFacilities, mockBatches, mockCreate } = vi.hoisted(() => ({
  mockList: vi.fn(),
  mockMedicines: vi.fn(),
  mockFacilities: vi.fn(),
  mockBatches: vi.fn(),
  mockCreate: vi.fn(),
}));

vi.mock("../services/inventoryApi", () => ({
  inventoryApi: { list: mockList, medicines: mockMedicines, facilities: mockFacilities, batches: mockBatches },
  medicineApi: { create: mockCreate },
}));

vi.mock("../components/InventoryAgentPanel", () => ({ InventoryAgentPanel: () => null }));

describe("InventoryPage medicine code validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockList.mockResolvedValue([]);
    mockMedicines.mockResolvedValue([]);
    mockFacilities.mockResolvedValue([]);
    mockBatches.mockResolvedValue([]);
    mockCreate.mockResolvedValue({});
  });

  it("shows field errors and does not call the API for an invalid code on submit", async () => {
    render(<MemoryRouter><InventoryPage /></MemoryRouter>);
    fireEvent.click(await screen.findByRole("button", { name: /add medicine/i }));
    fireEvent.change(screen.getByLabelText("Medicine code"), { target: { value: "PARA500" } });
    fireEvent.change(screen.getByLabelText("Medicine name"), { target: { value: "Paracetamol" } });
    fireEvent.click(screen.getByRole("button", { name: "Create medicine" }));

    expect(await screen.findByText("Medicine code must follow the format MEDICINE-###, for example PARA-500.")).toBeInTheDocument();
    await waitFor(() => expect(mockCreate).not.toHaveBeenCalled());
  });
});

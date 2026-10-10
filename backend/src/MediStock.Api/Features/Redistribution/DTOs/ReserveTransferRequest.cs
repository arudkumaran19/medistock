using System;
using System.Collections.Generic;

namespace MediStock.Api.Features.Redistribution.DTOs;

public class ReserveTransferRequest
{
    public Guid UserId { get; set; }
    public string? Notes { get; set; }
    public List<ReserveItemAllocationDto> ItemAllocations { get; set; } = new();

    // Flat compatibility fields for React & mobile clients
    public Guid? TransferId { get; set; }
    public Guid? SourceFacilityId { get; set; }
    public Guid? MedicineId { get; set; }
    public int? QuantityToReserve { get; set; }
    public string? BatchNumber { get; set; }
}

public class ReserveItemAllocationDto
{
    public Guid TransferItemId { get; set; }
    public int AllocatedQuantity { get; set; }
    public string? BatchNumber { get; set; }
    public DateTime? ExpiryDate { get; set; }
}

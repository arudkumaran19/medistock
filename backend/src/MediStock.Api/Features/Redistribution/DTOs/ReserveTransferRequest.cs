using System;
using System.Collections.Generic;

namespace MediStock.Api.Features.Redistribution.DTOs;

public class ReserveTransferRequest
{
    public Guid UserId { get; set; }
    public string? Notes { get; set; }
    public List<ReserveItemAllocationDto> ItemAllocations { get; set; } = new();
}

public class ReserveItemAllocationDto
{
    public Guid TransferItemId { get; set; }
    public int AllocatedQuantity { get; set; }
    public string? BatchNumber { get; set; }
    public DateTime? ExpiryDate { get; set; }
}

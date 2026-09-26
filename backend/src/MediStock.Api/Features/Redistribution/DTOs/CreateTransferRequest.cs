using System;
using System.Collections.Generic;
using MediStock.Api.Domain.Enums;

namespace MediStock.Api.Features.Redistribution.DTOs;

public class CreateTransferRequest
{
    public Guid DestinationFacilityId { get; set; }
    public Guid? SourceFacilityId { get; set; }
    public TransferPriority Priority { get; set; } = TransferPriority.Medium;
    public string? Notes { get; set; }
    public Guid? RequestedByUserId { get; set; }

    public List<CreateTransferItemDto> Items { get; set; } = new();
}

public class CreateTransferItemDto
{
    public Guid MedicineId { get; set; }
    public string MedicineName { get; set; } = string.Empty;
    public int RequestedQuantity { get; set; }
    public string UnitOfMeasure { get; set; } = "units";
}

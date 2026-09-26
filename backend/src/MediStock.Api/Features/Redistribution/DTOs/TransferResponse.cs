using System;
using System.Collections.Generic;
using MediStock.Api.Domain.Enums;

namespace MediStock.Api.Features.Redistribution.DTOs;

public class TransferResponse
{
    public Guid Id { get; set; }
    public string TransferNumber { get; set; } = string.Empty;

    public Guid? SourceFacilityId { get; set; }
    public string? SourceFacilityName { get; set; }

    public Guid DestinationFacilityId { get; set; }
    public string DestinationFacilityName { get; set; } = string.Empty;

    public TransferStatus Status { get; set; }
    public TransferPriority Priority { get; set; }

    public decimal? EstimatedDistanceKm { get; set; }
    public decimal? EstimatedDurationMinutes { get; set; }
    public string? RoutingProvider { get; set; }
    public string? RoutePolyline { get; set; }

    public Guid RequestedByUserId { get; set; }
    public Guid? ApprovedByUserId { get; set; }

    public DateTime? DispatchedAt { get; set; }
    public DateTime? ReceivedAt { get; set; }

    public string? RejectionReason { get; set; }
    public string? Notes { get; set; }
    public Guid? WorkflowRunId { get; set; }

    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public List<TransferItemDto> Items { get; set; } = new();
    public List<TransferStatusHistoryDto> StatusHistory { get; set; } = new();
}

public class TransferItemDto
{
    public Guid Id { get; set; }
    public Guid MedicineId { get; set; }
    public string MedicineName { get; set; } = string.Empty;
    public int RequestedQuantity { get; set; }
    public int AllocatedQuantity { get; set; }
    public int? ReceivedQuantity { get; set; }
    public string UnitOfMeasure { get; set; } = "units";
    public string? BatchNumber { get; set; }
    public DateTime? ExpiryDate { get; set; }
}

public class TransferStatusHistoryDto
{
    public Guid Id { get; set; }
    public TransferStatus? FromStatus { get; set; }
    public TransferStatus ToStatus { get; set; }
    public Guid ChangedByUserId { get; set; }
    public DateTime ChangedAt { get; set; }
    public string? Reason { get; set; }
    public string? MetadataJson { get; set; }
}

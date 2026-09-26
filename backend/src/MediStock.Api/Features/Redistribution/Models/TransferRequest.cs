using System;
using System.Collections.Generic;
using MediStock.Api.Domain.Entities;
using MediStock.Api.Domain.Enums;

namespace MediStock.Api.Features.Redistribution.Models;

public class TransferRequest
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string TransferNumber { get; set; } = string.Empty;

    public Guid? SourceFacilityId { get; set; }
    public Facility? SourceFacility { get; set; }

    public Guid DestinationFacilityId { get; set; }
    public Facility? DestinationFacility { get; set; }

    public TransferStatus Status { get; set; } = TransferStatus.Draft;
    public TransferPriority Priority { get; set; } = TransferPriority.Medium;

    public decimal? EstimatedDistanceKm { get; set; }
    public decimal? EstimatedDurationMinutes { get; set; }
    public string? RoutingProvider { get; set; }
    public string? RoutePolyline { get; set; } // Encoded polyline or GeoJSON string

    public Guid RequestedByUserId { get; set; }
    public Guid? ApprovedByUserId { get; set; }

    public DateTime? DispatchedAt { get; set; }
    public DateTime? ReceivedAt { get; set; }

    public string? RejectionReason { get; set; }
    public string? Notes { get; set; }

    public Guid? WorkflowRunId { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<TransferItem> Items { get; set; } = new List<TransferItem>();
    public ICollection<TransferStatusHistory> StatusHistory { get; set; } = new List<TransferStatusHistory>();
}

namespace MediStock.Api.Features.Redistribution.DTOs;

/// <summary>A transfer as returned by the API, with names resolved. Redistribution vertical.</summary>
public sealed class TransferResponse
{
    public Guid Id { get; set; }

    public string TransferNumber { get; set; } = string.Empty;

    public Guid MedicineId { get; set; }

    public string MedicineName { get; set; } = string.Empty;

    public string Unit { get; set; } = "unit";

    public Guid? SourceFacilityId { get; set; }

    public string? SourceFacilityName { get; set; }

    public Guid DestinationFacilityId { get; set; }

    public string DestinationFacilityName { get; set; } = string.Empty;

    public int Quantity { get; set; }

    public string Priority { get; set; } = string.Empty;

    public string Status { get; set; } = string.Empty;

    public string? BatchNumber { get; set; }

    public decimal? EstimatedDistanceKm { get; set; }

    public decimal? EstimatedDurationMinutes { get; set; }

    public string? RoutingProvider { get; set; }

    public string? Notes { get; set; }

    public string? RejectionReason { get; set; }

    public DateTime CreatedAtUtc { get; set; }

    public DateTime UpdatedAtUtc { get; set; }

    public DateTime? DispatchedAtUtc { get; set; }

    public DateTime? DeliveredAtUtc { get; set; }

    /// <summary>Statuses this transfer may move to next, so the UI offers only valid actions.</summary>
    public IReadOnlyList<string> AllowedNextStatuses { get; set; } = Array.Empty<string>();

    public IReadOnlyList<TransferHistoryResponse> History { get; set; } = Array.Empty<TransferHistoryResponse>();
}

public sealed class TransferHistoryResponse
{
    public string? FromStatus { get; set; }

    public string ToStatus { get; set; } = string.Empty;

    public string? ChangedBy { get; set; }

    public DateTime ChangedAtUtc { get; set; }

    public string? Reason { get; set; }
}

/// <summary>Counts per status for the dashboard cards.</summary>
public sealed class TransferSummaryResponse
{
    public int PendingApproval { get; set; }

    public int ApprovedOrReserved { get; set; }

    public int InTransit { get; set; }

    public int Delivered { get; set; }
}

/// <summary>Route between the two facilities, for the detail page and map.</summary>
public sealed class TransferRouteResponse
{
    public Guid SourceFacilityId { get; set; }

    public string SourceFacilityName { get; set; } = string.Empty;

    public double SourceLatitude { get; set; }

    public double SourceLongitude { get; set; }

    public Guid DestinationFacilityId { get; set; }

    public string DestinationFacilityName { get; set; } = string.Empty;

    public double DestinationLatitude { get; set; }

    public double DestinationLongitude { get; set; }

    public decimal DistanceKm { get; set; }

    public decimal DurationMinutes { get; set; }

    public string Provider { get; set; } = string.Empty;
}

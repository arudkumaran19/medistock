namespace MediStock.Api.Features.Redistribution.DTOs;

using MediStock.Api.Domain.Enums;

/// <summary>
/// Body of POST /api/transfers. Redistribution vertical (Member 3).
/// The destination is the facility short of stock; the source is chosen later from
/// the ranked candidates.
/// </summary>
public sealed class CreateTransferRequest
{
    public Guid MedicineId { get; set; }

    public Guid DestinationFacilityId { get; set; }

    public int Quantity { get; set; }

    public TransferPriority Priority { get; set; } = TransferPriority.Medium;

    public string? Notes { get; set; }

    /// <summary>True to submit straight away (Requested); false keeps it as a Draft.</summary>
    public bool Submit { get; set; } = true;
}

/// <summary>Body of PUT /api/transfers/{id}. Only allowed while Draft or Requested.</summary>
public sealed class UpdateTransferRequest
{
    public int Quantity { get; set; }

    public TransferPriority Priority { get; set; } = TransferPriority.Medium;

    public string? Notes { get; set; }
}

/// <summary>Body of POST /api/transfers/{id}/propose.</summary>
public sealed class ProposeSourceRequest
{
    public Guid SourceFacilityId { get; set; }

    public string? Reason { get; set; }
}

/// <summary>Body of the transition endpoints that take an optional or required reason.</summary>
public sealed class TransferActionRequest
{
    public string? Reason { get; set; }
}

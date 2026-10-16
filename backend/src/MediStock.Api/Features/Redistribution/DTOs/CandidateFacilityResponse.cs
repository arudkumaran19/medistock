namespace MediStock.Api.Features.Redistribution.DTOs;

/// <summary>
/// A facility that could supply a transfer, with the figures behind its ranking.
/// Redistribution vertical (Member 3).
/// </summary>
public sealed class CandidateFacilityResponse
{
    public Guid FacilityId { get; set; }

    public string FacilityName { get; set; } = string.Empty;

    public int QuantityOnHand { get; set; }

    public int QuantityReserved { get; set; }

    public int MinimumStock { get; set; }

    /// <summary>On hand minus reserved minus the medicine's minimum stock level.</summary>
    public int AvailableSurplus { get; set; }

    /// <summary>True when the surplus covers the whole requested quantity.</summary>
    public bool CanFulfil { get; set; }

    public DateTime? NearestExpiryUtc { get; set; }

    public decimal DistanceKm { get; set; }

    public decimal DurationMinutes { get; set; }

    /// <summary>0-100: 60 for how much of the request the surplus covers, 40 for proximity.</summary>
    public decimal Score { get; set; }
}

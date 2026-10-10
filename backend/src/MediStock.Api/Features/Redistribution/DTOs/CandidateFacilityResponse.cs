using System;

namespace MediStock.Api.Features.Redistribution.DTOs;

public class CandidateFacilityResponse
{
    public Guid FacilityId { get; set; }
    public string FacilityName { get; set; } = string.Empty;
    public string FacilityCode { get; set; } = string.Empty;
    public string FacilityType { get; set; } = string.Empty;
    public string City { get; set; } = string.Empty;
    public double Latitude { get; set; }
    public double Longitude { get; set; }

    public int AvailableSurplus { get; set; }
    public int StockOnHand { get; set; }
    public int SafetyStockThreshold { get; set; }

    public decimal DistanceKm { get; set; }
    public decimal EstimatedDurationMinutes { get; set; }
    public string RoutingProvider { get; set; } = string.Empty;

    public int RecommendedQuantity { get; set; }
    public double Score { get; set; } // Algorithm ranking score based on surplus and proximity
}

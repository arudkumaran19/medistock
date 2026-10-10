using System;

namespace MediStock.Api.Features.Redistribution.DTOs;

public class DispatchTransferRequest
{
    public Guid UserId { get; set; }
    public string? Notes { get; set; }
    public string? CarrierName { get; set; }
    public string? TrackingNumber { get; set; }
}

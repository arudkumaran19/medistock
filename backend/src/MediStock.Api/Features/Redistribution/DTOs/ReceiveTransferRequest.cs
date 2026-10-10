using System;
using System.Collections.Generic;

namespace MediStock.Api.Features.Redistribution.DTOs;

public class ReceiveTransferRequest
{
    public Guid ReceivedByUserId { get; set; }
    public string? Notes { get; set; }
    public List<ReceiveItemVerificationDto> VerifiedItems { get; set; } = new();

    // Flat compatibility fields for Flutter & Web clients
    public int? ReceivedQuantity { get; set; }
    public string? BatchNumber { get; set; }
    public string? DiscrepancyReason { get; set; }
    public Guid? DestinationFacilityId { get; set; }
    public Guid? TransferId { get; set; }
}

public class ReceiveItemVerificationDto
{
    public Guid TransferItemId { get; set; }
    public int ReceivedQuantity { get; set; }
    public string? BatchNumber { get; set; }
    public string? DiscrepancyReason { get; set; }
}

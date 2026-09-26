using System;
using System.Collections.Generic;

namespace MediStock.Api.Features.Redistribution.DTOs;

public class ReceiveTransferRequest
{
    public Guid ReceivedByUserId { get; set; }
    public string? Notes { get; set; }
    public List<ReceiveItemVerificationDto> VerifiedItems { get; set; } = new();
}

public class ReceiveItemVerificationDto
{
    public Guid TransferItemId { get; set; }
    public int ReceivedQuantity { get; set; }
    public string? BatchNumber { get; set; }
    public string? DiscrepancyReason { get; set; }
}

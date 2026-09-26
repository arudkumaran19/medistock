using System;
using System.Collections.Generic;

namespace MediStock.Api.Features.Workflow.DTOs;

public class StartWorkflowRequest
{
    public Guid TransferRequestId { get; set; }
    public Guid DestinationFacilityId { get; set; }
    public Guid MedicineId { get; set; }
    public int ShortageQuantity { get; set; }
    public Guid InitiatorUserId { get; set; }
    public string? AdditionalContext { get; set; }
}

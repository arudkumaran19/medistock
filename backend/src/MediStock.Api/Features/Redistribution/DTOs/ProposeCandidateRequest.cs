using System;

namespace MediStock.Api.Features.Redistribution.DTOs;

public class ProposeCandidateRequest
{
    public Guid SourceFacilityId { get; set; }
    public Guid? UserId { get; set; }
    public string? Notes { get; set; }
}

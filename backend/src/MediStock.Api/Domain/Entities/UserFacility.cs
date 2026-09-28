namespace MediStock.Api.Domain.Entities;

public sealed class UserFacility
{
    public Guid UserId { get; set; }

    public Guid FacilityId { get; set; }
}

namespace MediStock.Api.Features.Inventory.DTOs;

public sealed record FacilityResponse(Guid Id, string Code, string Name, string Address, bool IsActive);
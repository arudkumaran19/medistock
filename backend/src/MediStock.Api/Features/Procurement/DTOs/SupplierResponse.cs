namespace MediStock.Api.Features.Procurement.DTOs;

public sealed record SupplierResponse(
    Guid Id,
    string Name,
    string ContactPerson,
    string Email,
    string Phone,
    string Address,
    int LeadTimeDays,
    bool IsActive);
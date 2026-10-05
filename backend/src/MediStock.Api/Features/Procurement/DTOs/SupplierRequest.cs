namespace MediStock.Api.Features.Procurement.DTOs;

public sealed record SupplierRequest(
    string Name,
    string ContactPerson,
    string Email,
    string Phone,
    string Address,
    int LeadTimeDays,
    bool IsActive);
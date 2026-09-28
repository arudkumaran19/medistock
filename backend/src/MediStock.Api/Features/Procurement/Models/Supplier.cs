namespace MediStock.Api.Features.Procurement.Models;

public sealed class Supplier
{
    public Guid Id { get; set; }

    public string Name { get; set; } = string.Empty;

    public string ContactPerson { get; set; } = string.Empty;

    public string Email { get; set; } = string.Empty;

    public string Phone { get; set; } = string.Empty;

    public string Address { get; set; } = string.Empty;

    public int LeadTimeDays { get; set; }

    public bool IsActive { get; set; } = true;
}
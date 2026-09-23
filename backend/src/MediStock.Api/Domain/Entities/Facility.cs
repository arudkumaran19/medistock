namespace MediStock.Api.Domain.Entities;

public sealed class Facility
{
    public Guid Id { get; set; }

    public string Name { get; set; } = string.Empty;

    public bool IsActive { get; set; } = true;
}

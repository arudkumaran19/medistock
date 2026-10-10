namespace MediStock.Api.Domain.Entities;

public class Medicine
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Name { get; set; } = string.Empty;
    public string GenericName { get; set; } = string.Empty;
    public string Sku { get; set; } = string.Empty;
    public string UnitOfMeasure { get; set; } = "units";
    public string Category { get; set; } = "General";
    public bool RequiresRefrigeration { get; set; } = false;
    public bool IsActive { get; set; } = true;
}

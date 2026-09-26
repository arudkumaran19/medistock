namespace MediStock.Api.Domain.Entities;

public class Facility
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Name { get; set; } = string.Empty;
    public string FacilityCode { get; set; } = string.Empty;
    public string FacilityType { get; set; } = "Hospital"; // Hospital, Clinic, Central Depot
    public double Latitude { get; set; }
    public double Longitude { get; set; }
    public string Address { get; set; } = string.Empty;
    public string City { get; set; } = string.Empty;
    public string ContactPhone { get; set; } = string.Empty;
    public string ContactPerson { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;

    public ICollection<FacilityInventory> Inventories { get; set; } = new List<FacilityInventory>();
}

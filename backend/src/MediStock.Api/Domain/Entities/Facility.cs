using System;
using System.Collections.Generic;

namespace MediStock.Api.Domain.Entities;

public sealed class Facility
{
    private string _code = string.Empty;
    private string _facilityCode = string.Empty;

    public Guid Id { get; set; } = Guid.NewGuid();

    public string Name { get; set; } = string.Empty;

    public string Code
    {
        get => !string.IsNullOrEmpty(_code) ? _code : _facilityCode;
        set
        {
            _code = value;
            if (string.IsNullOrEmpty(_facilityCode))
            {
                _facilityCode = value;
            }
        }
    }

    public string FacilityCode
    {
        get => !string.IsNullOrEmpty(_facilityCode) ? _facilityCode : _code;
        set
        {
            _facilityCode = value;
            if (string.IsNullOrEmpty(_code))
            {
                _code = value;
            }
        }
    }

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

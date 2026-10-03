using System;
using System.ComponentModel.DataAnnotations;

namespace MediStock.Api.Features.Redistribution.DTOs;

public class UpdateTransferLocationRequest
{
    [Required]
    [Range(-90.0, 90.0)]
    public double Latitude { get; set; }

    [Required]
    [Range(-180.0, 180.0)]
    public double Longitude { get; set; }

    public double? Speed { get; set; }

    public double? Heading { get; set; }

    public DateTime? Timestamp { get; set; }
}

public class TransferLocationUpdateDto
{
    public Guid TransferId { get; set; }
    public double Latitude { get; set; }
    public double Longitude { get; set; }
    public double? Speed { get; set; }
    public double? Heading { get; set; }
    public DateTime Timestamp { get; set; }
}

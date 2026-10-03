using System;

namespace MediStock.Api.Features.Redistribution.Models;

public class TransferNotification
{
    public Guid Id { get; set; } = Guid.NewGuid();
    
    public Guid TransferId { get; set; }
    public TransferRequest? TransferRequest { get; set; }

    public string Audience { get; set; } = string.Empty; // "FieldOfficer" or "Manager"
    public Guid? RecipientUserId { get; set; }

    public string Title { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;

    public bool IsRead { get; set; } = false;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

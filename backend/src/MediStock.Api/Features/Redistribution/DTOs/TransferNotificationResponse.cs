using System;

namespace MediStock.Api.Features.Redistribution.DTOs;

public class TransferNotificationResponse
{
    public Guid Id { get; set; }
    public Guid TransferId { get; set; }
    public string Audience { get; set; } = string.Empty;
    public Guid? RecipientUserId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public bool IsRead { get; set; }
    public DateTime CreatedAt { get; set; }
}

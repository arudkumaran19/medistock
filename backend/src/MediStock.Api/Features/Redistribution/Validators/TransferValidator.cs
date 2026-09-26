using System;
using System.Collections.Generic;
using System.Linq;
using FluentValidation;
using MediStock.Api.Domain.Enums;
using MediStock.Api.Features.Redistribution.DTOs;
using MediStock.Api.Features.Redistribution.Models;

namespace MediStock.Api.Features.Redistribution.Validators;

public class TransferValidator
{
    private static readonly Dictionary<TransferStatus, List<TransferStatus>> AllowedTransitions = new()
    {
        [TransferStatus.Draft] = new() { TransferStatus.Proposed, TransferStatus.Requested, TransferStatus.Cancelled },
        [TransferStatus.Proposed] = new() { TransferStatus.Requested, TransferStatus.Cancelled },
        [TransferStatus.Requested] = new() { TransferStatus.Approved, TransferStatus.Rejected, TransferStatus.Cancelled },
        [TransferStatus.Approved] = new() { TransferStatus.Reserved, TransferStatus.Cancelled },
        [TransferStatus.Reserved] = new() { TransferStatus.Dispatched, TransferStatus.Cancelled },
        [TransferStatus.Dispatched] = new() { TransferStatus.Received },
        [TransferStatus.Received] = new(),
        [TransferStatus.Rejected] = new(),
        [TransferStatus.Cancelled] = new()
    };

    public (bool IsValid, List<string> Errors) ValidateCreate(CreateTransferRequest request)
    {
        var errors = new List<string>();

        if (request.DestinationFacilityId == Guid.Empty)
        {
            errors.Add("Destination facility ID is required.");
        }

        if (request.Items == null || !request.Items.Any())
        {
            errors.Add("Transfer request must contain at least one item.");
        }
        else
        {
            for (var i = 0; i < request.Items.Count; i++)
            {
                var item = request.Items[i];
                if (item.MedicineId == Guid.Empty)
                {
                    errors.Add($"Item #{i + 1}: Medicine ID is required.");
                }
                if (item.RequestedQuantity <= 0)
                {
                    errors.Add($"Item #{i + 1}: Requested quantity must be greater than zero.");
                }
            }
        }

        return (!errors.Any(), errors);
    }

    public (bool IsValid, string? Error) ValidateStatusTransition(TransferStatus currentStatus, TransferStatus newStatus)
    {
        if (currentStatus == newStatus)
        {
            return (true, null);
        }

        if (!AllowedTransitions.TryGetValue(currentStatus, out var allowed) || !allowed.Contains(newStatus))
        {
            return (false, $"Invalid status transition from '{currentStatus}' to '{newStatus}'. Allowed next statuses: [{string.Join(", ", allowed ?? new List<TransferStatus>())}].");
        }

        return (true, null);
    }

    public (bool IsValid, List<string> Errors) ValidateReservation(TransferRequest transfer, ReserveTransferRequest request)
    {
        var errors = new List<string>();

        if (transfer.Status != TransferStatus.Approved)
        {
            errors.Add($"Transfer must be in 'Approved' status to reserve inventory. Current status is '{transfer.Status}'.");
        }

        if (transfer.SourceFacilityId == null || transfer.SourceFacilityId == Guid.Empty)
        {
            errors.Add("Cannot reserve stock without an assigned source facility.");
        }

        if (request.ItemAllocations == null || !request.ItemAllocations.Any())
        {
            errors.Add("Reservation request must contain item allocations.");
        }
        else
        {
            foreach (var alloc in request.ItemAllocations)
            {
                if (alloc.AllocatedQuantity <= 0)
                {
                    errors.Add($"Allocated quantity for item {alloc.TransferItemId} must be greater than zero.");
                }

                var item = transfer.Items.FirstOrDefault(i => i.Id == alloc.TransferItemId);
                if (item == null)
                {
                    errors.Add($"Transfer item {alloc.TransferItemId} does not belong to this transfer.");
                }
            }
        }

        return (!errors.Any(), errors);
    }

    public (bool IsValid, List<string> Errors) ValidateReceipt(TransferRequest transfer, ReceiveTransferRequest request)
    {
        var errors = new List<string>();

        if (transfer.Status != TransferStatus.Dispatched)
        {
            errors.Add($"Transfer must be in 'Dispatched' status to be received. Current status is '{transfer.Status}'.");
        }

        if (request.VerifiedItems == null || !request.VerifiedItems.Any())
        {
            errors.Add("Receipt must contain verification for transfer items.");
        }
        else
        {
            foreach (var item in request.VerifiedItems)
            {
                if (item.ReceivedQuantity < 0)
                {
                    errors.Add($"Received quantity for item {item.TransferItemId} cannot be negative.");
                }

                if (!transfer.Items.Any(i => i.Id == item.TransferItemId))
                {
                    errors.Add($"Transfer item {item.TransferItemId} does not belong to this transfer.");
                }
            }
        }

        return (!errors.Any(), errors);
    }
}

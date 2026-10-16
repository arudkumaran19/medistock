namespace MediStock.Api.Features.Redistribution.Validators;

using MediStock.Api.Domain.Enums;
using MediStock.Api.Features.Redistribution.DTOs;

/// <summary>
/// Request validation and the transfer state machine. Redistribution vertical (Member 3).
///
/// The transitions follow the redistribution design:
///   Draft     -> Requested | Proposed | Cancelled
///   Requested -> Proposed  | Approved | Rejected | Cancelled
///   Proposed  -> Proposed  | Approved | Rejected | Cancelled   (re-proposing swaps the source)
///   Approved  -> Reserved  | Cancelled
///   Reserved  -> InTransit | Cancelled
///   InTransit -> Delivered
/// Delivered, Rejected and Cancelled are final.
/// </summary>
public static class TransferValidator
{
    public const int MaxQuantity = 100_000;

    private static readonly Dictionary<TransferStatus, TransferStatus[]> Transitions = new()
    {
        [TransferStatus.Draft] = new[] { TransferStatus.Requested, TransferStatus.Proposed, TransferStatus.Cancelled },
        [TransferStatus.Requested] = new[] { TransferStatus.Proposed, TransferStatus.Approved, TransferStatus.Rejected, TransferStatus.Cancelled },
        [TransferStatus.Proposed] = new[] { TransferStatus.Proposed, TransferStatus.Approved, TransferStatus.Rejected, TransferStatus.Cancelled },
        [TransferStatus.Approved] = new[] { TransferStatus.Reserved, TransferStatus.Cancelled },
        [TransferStatus.Reserved] = new[] { TransferStatus.InTransit, TransferStatus.Cancelled },
        [TransferStatus.InTransit] = new[] { TransferStatus.Delivered },
        [TransferStatus.Delivered] = Array.Empty<TransferStatus>(),
        [TransferStatus.Rejected] = Array.Empty<TransferStatus>(),
        [TransferStatus.Cancelled] = Array.Empty<TransferStatus>(),
    };

    public static IReadOnlyList<TransferStatus> NextStatuses(TransferStatus current) => Transitions[current];

    public static bool CanTransition(TransferStatus from, TransferStatus to) => Transitions[from].Contains(to);

    /// <summary>Editable fields may change only before a manager has acted on the request.</summary>
    public static bool IsEditable(TransferStatus status) =>
        status is TransferStatus.Draft or TransferStatus.Requested;

    public static string? ValidateCreate(CreateTransferRequest request)
    {
        if (request.MedicineId == Guid.Empty) return "medicineId is required.";
        if (request.DestinationFacilityId == Guid.Empty) return "destinationFacilityId is required.";
        return ValidateQuantityAndNotes(request.Quantity, request.Notes);
    }

    public static string? ValidateUpdate(UpdateTransferRequest request) =>
        ValidateQuantityAndNotes(request.Quantity, request.Notes);

    private static string? ValidateQuantityAndNotes(int quantity, string? notes)
    {
        if (quantity <= 0) return "Quantity must be greater than zero.";
        if (quantity > MaxQuantity) return $"Quantity must be {MaxQuantity:N0} or fewer.";
        if (notes is { Length: > 1000 }) return "Notes must be 1000 characters or fewer.";
        return null;
    }
}

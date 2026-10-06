using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using MediStock.Api.Common;
using MediStock.Api.Data;
using MediStock.Api.Features.Procurement.DTOs;
using MediStock.Api.Features.Procurement.Models;
using MediStock.Api.Features.Redistribution.Hubs;

namespace MediStock.Api.Features.Procurement.Services;

public class ProcurementBridgeService : IProcurementBridgeService
{
    private readonly MediStockDbContext _dbContext;
    private readonly IHubContext<TransferHub, ITransferHubClient> _hubContext;
    private readonly ILogger<ProcurementBridgeService> _logger;

    public ProcurementBridgeService(
        MediStockDbContext dbContext,
        IHubContext<TransferHub, ITransferHubClient> hubContext,
        ILogger<ProcurementBridgeService> logger)
    {
        _dbContext = dbContext;
        _hubContext = hubContext;
        _logger = logger;
    }

    public async Task<ApiResponse<ReplenishmentRequestDto>> CreateReplenishmentRequestFromTransferAsync(
        Guid transferId,
        Guid rejectorUserId,
        string reason,
        CancellationToken ct = default)
    {
        _dbContext.ChangeTracker.Clear();
        var transfer = await _dbContext.TransferRequests
            .Include(t => t.DestinationFacility)
            .Include(t => t.Items)
            .FirstOrDefaultAsync(t => t.Id == transferId, ct);

        if (transfer == null)
        {
            return ApiResponse<ReplenishmentRequestDto>.Fail($"Transfer request {transferId} not found.");
        }

        var firstItem = transfer.Items.FirstOrDefault();
        var medicineId = firstItem?.MedicineId ?? Guid.Parse("b0000000-0000-0000-0000-000000000001");
        var quantity = firstItem?.RequestedQuantity ?? 100;

        var replenishment = new ReplenishmentRequest
        {
            Id = Guid.NewGuid(),
            SourceTransferId = transfer.Id,
            FacilityId = transfer.DestinationFacilityId,
            MedicineId = medicineId,
            RequestedQuantity = quantity,
            Reason = $"Transfer rejected: {reason}",
            Priority = transfer.Priority.ToString(),
            CreatedByUserId = rejectorUserId,
            CreatedAt = DateTime.UtcNow,
            Status = "PendingPO"
        };

        _dbContext.ReplenishmentRequests.Add(replenishment);
        await _dbContext.SaveChangesAsync(ct);

        var dto = new ReplenishmentRequestDto
        {
            Id = replenishment.Id,
            SourceTransferId = replenishment.SourceTransferId,
            SourceTransferNumber = transfer.TransferNumber,
            FacilityId = replenishment.FacilityId,
            FacilityName = transfer.DestinationFacility?.Name,
            MedicineId = replenishment.MedicineId,
            MedicineName = firstItem?.MedicineName,
            RequestedQuantity = replenishment.RequestedQuantity,
            Reason = replenishment.Reason,
            Priority = replenishment.Priority,
            CreatedByUserId = replenishment.CreatedByUserId,
            CreatedAt = replenishment.CreatedAt,
            Status = replenishment.Status
        };

        await _hubContext.Clients.Group("procurement").ReplenishmentRequested(dto);
        _logger.LogInformation("Broadcasting ReplenishmentRequested for transfer {TransferNumber} to procurement group", transfer.TransferNumber);

        return ApiResponse<ReplenishmentRequestDto>.Ok(dto, "Replenishment request created successfully.");
    }
}

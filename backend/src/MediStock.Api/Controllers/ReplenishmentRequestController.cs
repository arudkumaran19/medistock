using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MediStock.Api.Common;
using MediStock.Api.Features.Procurement.DTOs;
using MediStock.Api.Features.Procurement.Models;
using MediStock.Api.Data;

namespace MediStock.Api.Controllers;

[ApiController]
[Route("api/procurement/replenishment-requests")]
public class ReplenishmentRequestController : ControllerBase
{
    private readonly MediStockDbContext _dbContext;

    public ReplenishmentRequestController(MediStockDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    [HttpGet]
    public async Task<IActionResult> GetReplenishmentRequests([FromQuery] string? status = null, CancellationToken ct = default)
    {
        var query = _dbContext.ReplenishmentRequests
            .Include(r => r.Facility)
            .Include(r => r.Medicine)
            .Include(r => r.SourceTransfer)
            .AsNoTracking();

        if (!string.IsNullOrWhiteSpace(status))
        {
            query = query.Where(r => r.Status == status);
        }

        var requests = await query.OrderByDescending(r => r.CreatedAt).ToListAsync(ct);

        var dtos = requests.Select(r => new ReplenishmentRequestDto
        {
            Id = r.Id,
            SourceTransferId = r.SourceTransferId,
            SourceTransferNumber = r.SourceTransfer?.TransferNumber,
            FacilityId = r.FacilityId,
            FacilityName = r.Facility?.Name,
            MedicineId = r.MedicineId,
            MedicineName = r.Medicine?.Name,
            RequestedQuantity = r.RequestedQuantity,
            Reason = r.Reason,
            Priority = r.Priority,
            CreatedByUserId = r.CreatedByUserId,
            CreatedAt = r.CreatedAt,
            Status = r.Status,
            PurchaseOrderId = r.PurchaseOrderId
        }).ToList();

        return Ok(ApiResponse<System.Collections.Generic.List<ReplenishmentRequestDto>>.Ok(dtos, "Replenishment requests retrieved successfully."));
    }

    [HttpPost("{id:guid}/create-po")]
    public async Task<IActionResult> CreatePurchaseOrder(
        Guid id,
        [FromBody] CreatePurchaseOrderFromReplenishmentDto request,
        CancellationToken ct = default)
    {
        var replenishment = await _dbContext.ReplenishmentRequests
            .Include(r => r.Facility)
            .Include(r => r.Medicine)
            .FirstOrDefaultAsync(r => r.Id == id, ct);

        if (replenishment == null)
        {
            return NotFound(ApiResponse<string>.Fail($"Replenishment request {id} not found."));
        }

        var firstSupplier = await _dbContext.Suppliers.FirstOrDefaultAsync(ct);
        var supplierId = request.SupplierId ?? firstSupplier?.Id ?? Guid.Parse("d1000001-0000-4000-8000-000000000001");

        var po = new PurchaseOrder
        {
            Id = Guid.NewGuid(),
            SupplierId = supplierId,
            FacilityId = replenishment.FacilityId,
            Status = Domain.Enums.PurchaseOrderStatus.Draft,
            RequestedAt = DateTime.UtcNow
        };

        po.Items.Add(new PurchaseOrderItem
        {
            Id = Guid.NewGuid(),
            PurchaseOrderId = po.Id,
            MedicineId = replenishment.MedicineId,
            RequestedQuantity = replenishment.RequestedQuantity,
            UnitPrice = request.UnitPrice ?? 50.0m
        });

        _dbContext.PurchaseOrders.Add(po);
        await _dbContext.SaveChangesAsync(ct);

        replenishment.PurchaseOrder = po;
        replenishment.PurchaseOrderId = po.Id;
        replenishment.Status = "PO_CREATED";

        await _dbContext.SaveChangesAsync(ct);

        return Ok(ApiResponse<object>.Ok(new
        {
            purchaseOrderId = po.Id,
            supplierId = po.SupplierId,
            status = po.Status.ToString(),
            replenishmentRequestId = replenishment.Id,
            replenishmentStatus = replenishment.Status
        }, "Purchase order created successfully from replenishment request."));
    }
}

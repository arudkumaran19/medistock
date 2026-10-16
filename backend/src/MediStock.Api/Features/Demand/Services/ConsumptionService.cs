namespace MediStock.Api.Features.Demand.Services;

using MediStock.Api.Common;
using MediStock.Api.Features.Demand.DTOs;
using MediStock.Api.Features.Demand.Models;
using MediStock.Api.Features.Demand.Validators;
using MediStock.Api.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

/// <summary>
/// Historical consumption for the Demand &amp; Shortage vertical.
/// Sathurstiga S. (IT24103156).
///
/// This is the first stage of the demonstration chain:
/// consumption -&gt; forecast -&gt; projected stockout -&gt; shortage alert.
/// </summary>
public class ConsumptionService
{
    private readonly ApplicationDbContext _db;
    private readonly ILogger<ConsumptionService> _logger;

    public ConsumptionService(ApplicationDbContext db, ILogger<ConsumptionService> logger)
    {
        _db = db;
        _logger = logger;
    }

    /// <summary>
    /// Paged, searchable, sortable, filterable consumption list.
    /// </summary>
    public async Task<PagedResponse<ConsumptionResponse>> GetConsumptionAsync(
        ConsumptionQuery query,
        CancellationToken cancellationToken = default)
    {
        var (page, pageSize) = DemandValidator.NormalisePaging(query.Page, query.PageSize);

        var records = _db.ConsumptionRecords.AsNoTracking();

        if (query.FacilityId is { } facilityId && facilityId != Guid.Empty)
        {
            records = records.Where(x => x.FacilityId == facilityId);
        }

        if (query.MedicineId is { } medicineId && medicineId != Guid.Empty)
        {
            records = records.Where(x => x.MedicineId == medicineId);
        }

        if (query.FromDate is { } fromDate)
        {
            var from = DateTime.SpecifyKind(fromDate.Date, DateTimeKind.Utc);
            records = records.Where(x => x.ConsumptionDate >= from);
        }

        if (query.ToDate is { } toDate)
        {
            var to = DateTime.SpecifyKind(toDate.Date, DateTimeKind.Utc);
            records = records.Where(x => x.ConsumptionDate <= to);
        }

        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            // ToLower + Contains keeps the same translation on PostgreSQL and on the
            // in-memory provider used by the tests.
            var term = query.Search.Trim().ToLowerInvariant();
            records = records.Where(x =>
                x.Source.ToLower().Contains(term) ||
                (x.Notes != null && x.Notes.ToLower().Contains(term)));
        }

        records = ApplySort(records, query.SortBy, query.SortOrder);

        var totalCount = await records.CountAsync(cancellationToken);

        var items = await records
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(x => ToResponse(x))
            .ToListAsync(cancellationToken);

        return new PagedResponse<ConsumptionResponse>(items, totalCount, page, pageSize);
    }

    /// <summary>
    /// Records a new consumption observation. Entry point for the Flutter operational app.
    /// </summary>
    public async Task<ConsumptionResponse> CreateConsumptionAsync(
        ConsumptionRequest request,
        CancellationToken cancellationToken = default)
    {
        var record = new ConsumptionRecord
        {
            Id = Guid.NewGuid(),
            FacilityId = request.FacilityId,
            MedicineId = request.MedicineId,
            QuantityUsed = request.QuantityUsed,
            ConsumptionDate = DateTime.SpecifyKind(request.ConsumptionDate.Date, DateTimeKind.Utc),
            Source = request.Source.Trim(),
            Notes = request.Notes?.Trim(),
            CreatedAt = DateTime.UtcNow
        };

        _db.ConsumptionRecords.Add(record);
        await _db.SaveChangesAsync(cancellationToken);

        _logger.LogInformation(
            "Consumption recorded {ConsumptionId} facility {FacilityId} medicine {MedicineId} quantity {QuantityUsed}",
            record.Id,
            record.FacilityId,
            record.MedicineId,
            record.QuantityUsed);

        return ToResponse(record);
    }

    /// <summary>
    /// A single consumption record. Null when it does not exist.
    /// </summary>
    public async Task<ConsumptionResponse?> GetConsumptionByIdAsync(
        Guid id,
        CancellationToken cancellationToken = default)
    {
        var record = await _db.ConsumptionRecords
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);

        return record is null ? null : ToResponse(record);
    }

    /// <summary>
    /// Corrects a consumption record. Null when it does not exist.
    ///
    /// Consumption is the input every forecast is built from, so a mis-keyed quantity
    /// silently skews demand until it is fixed. The corrected row is what later
    /// forecasts read - existing stored forecasts are not retrospectively altered.
    /// </summary>
    public async Task<ConsumptionResponse?> UpdateConsumptionAsync(
        Guid id,
        ConsumptionRequest request,
        CancellationToken cancellationToken = default)
    {
        var record = await _db.ConsumptionRecords
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);

        if (record is null)
        {
            return null;
        }

        record.FacilityId = request.FacilityId;
        record.MedicineId = request.MedicineId;
        record.QuantityUsed = request.QuantityUsed;
        record.ConsumptionDate = DateTime.SpecifyKind(request.ConsumptionDate.Date, DateTimeKind.Utc);
        record.Source = request.Source.Trim();
        record.Notes = request.Notes?.Trim();
        record.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync(cancellationToken);

        _logger.LogInformation(
            "Consumption {ConsumptionId} corrected to quantity {QuantityUsed} on {ConsumptionDate}",
            record.Id,
            record.QuantityUsed,
            record.ConsumptionDate);

        return ToResponse(record);
    }

    /// <summary>
    /// Removes a consumption record. False when it does not exist.
    ///
    /// Deleting rewrites the history later forecasts are derived from, so this is for
    /// entries made in error rather than routine housekeeping.
    /// </summary>
    public async Task<bool> DeleteConsumptionAsync(
        Guid id,
        CancellationToken cancellationToken = default)
    {
        var record = await _db.ConsumptionRecords
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);

        if (record is null)
        {
            return false;
        }

        _db.ConsumptionRecords.Remove(record);
        await _db.SaveChangesAsync(cancellationToken);

        _logger.LogWarning(
            "Consumption {ConsumptionId} deleted for facility {FacilityId} medicine {MedicineId}",
            record.Id,
            record.FacilityId,
            record.MedicineId);

        return true;
    }

    /// <summary>
    /// Raw consumption history for a facility and medicine across a window.
    /// Backs the agent tool getConsumptionHistory.
    /// </summary>
    public async Task<IReadOnlyList<ConsumptionRecord>> GetHistoryAsync(
        Guid facilityId,
        Guid medicineId,
        int windowDays,
        CancellationToken cancellationToken = default)
    {
        var from = DateTime.SpecifyKind(DateTime.UtcNow.Date.AddDays(-windowDays), DateTimeKind.Utc);

        return await _db.ConsumptionRecords
            .AsNoTracking()
            .Where(x => x.FacilityId == facilityId
                        && x.MedicineId == medicineId
                        && x.ConsumptionDate >= from)
            .OrderBy(x => x.ConsumptionDate)
            .ToListAsync(cancellationToken);
    }

    /// <summary>
    /// Average daily consumption across the window.
    /// Backs the agent tool calculateDailyConsumption.
    ///
    /// The divisor is the length of the window rather than the number of rows, so days
    /// with no recorded usage correctly pull the average down.
    /// </summary>
    public async Task<decimal> GetAverageDailyConsumptionAsync(
        Guid facilityId,
        Guid medicineId,
        int windowDays,
        CancellationToken cancellationToken = default)
    {
        if (windowDays <= 0)
        {
            return 0m;
        }

        var history = await GetHistoryAsync(facilityId, medicineId, windowDays, cancellationToken);

        return CalculateAverageDailyConsumption(history.Select(x => x.QuantityUsed), windowDays);
    }

    /// <summary>
    /// Deterministic average daily consumption. Pure function, kept separate from the
    /// database so the calculation itself is directly unit-testable.
    /// </summary>
    public static decimal CalculateAverageDailyConsumption(IEnumerable<decimal> quantities, int windowDays)
    {
        if (windowDays <= 0)
        {
            return 0m;
        }

        var total = quantities.Sum();

        return decimal.Round(total / windowDays, 4, MidpointRounding.AwayFromZero);
    }

    private static IQueryable<ConsumptionRecord> ApplySort(
        IQueryable<ConsumptionRecord> records,
        string? sortBy,
        string? sortOrder)
    {
        var descending = !string.Equals(sortOrder, "asc", StringComparison.OrdinalIgnoreCase);

        return (sortBy?.Trim().ToLowerInvariant()) switch
        {
            "quantityused" => descending
                ? records.OrderByDescending(x => x.QuantityUsed)
                : records.OrderBy(x => x.QuantityUsed),
            "createdat" => descending
                ? records.OrderByDescending(x => x.CreatedAt)
                : records.OrderBy(x => x.CreatedAt),
            "source" => descending
                ? records.OrderByDescending(x => x.Source)
                : records.OrderBy(x => x.Source),
            // Default ordering is newest consumption first.
            _ => descending
                ? records.OrderByDescending(x => x.ConsumptionDate)
                : records.OrderBy(x => x.ConsumptionDate)
        };
    }

    private static ConsumptionResponse ToResponse(ConsumptionRecord record) => new()
    {
        Id = record.Id,
        FacilityId = record.FacilityId,
        MedicineId = record.MedicineId,
        QuantityUsed = record.QuantityUsed,
        ConsumptionDate = record.ConsumptionDate,
        Source = record.Source,
        Notes = record.Notes,
        CreatedAt = record.CreatedAt
    };
}

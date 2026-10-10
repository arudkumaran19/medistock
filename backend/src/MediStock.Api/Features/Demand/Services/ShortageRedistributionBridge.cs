namespace MediStock.Api.Features.Demand.Services;

using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using MediStock.Api.Features.Demand.Models;
using MediStock.Api.Features.Redistribution.Hubs;
using MediStock.Api.Features.Redistribution.Services;
using MediStock.Api.Infrastructure.Persistence;

public interface IShortageRedistributionBridge
{
    Task ProcessShortageTransferHandoffAsync(Guid shortageAlertId, Guid transferRequestId, CancellationToken cancellationToken = default);
}

public class ShortageRedistributionBridge : IShortageRedistributionBridge
{
    private readonly ApplicationDbContext _appDb;
    private readonly ICandidateFacilityService _candidateService;
    private readonly IHubContext<TransferHub, ITransferHubClient> _hubContext;
    private readonly ILogger<ShortageRedistributionBridge> _logger;

    public ShortageRedistributionBridge(
        ApplicationDbContext appDb,
        ICandidateFacilityService candidateService,
        IHubContext<TransferHub, ITransferHubClient> hubContext,
        ILogger<ShortageRedistributionBridge> logger)
    {
        _appDb = appDb;
        _candidateService = candidateService;
        _hubContext = hubContext;
        _logger = logger;
    }

    public async Task ProcessShortageTransferHandoffAsync(Guid shortageAlertId, Guid transferRequestId, CancellationToken cancellationToken = default)
    {
        try
        {
            var alert = await _appDb.ShortageAlerts.FirstOrDefaultAsync(x => x.Id == shortageAlertId, cancellationToken);
            if (alert != null)
            {
                alert.RelatedTransferId = transferRequestId;
                alert.Status = ShortageAlertStatuses.RedistributionRequested;
                await _appDb.SaveChangesAsync(cancellationToken);
                _logger.LogInformation("Updated ShortageAlert {AlertId} status to REDISTRIBUTION_REQUESTED linked to transfer {TransferId}", shortageAlertId, transferRequestId);
            }

            // Find candidate source facilities using Redistribution module
            var candidates = await _candidateService.FindCandidatesForTransferAsync(transferRequestId, cancellationToken);
            _logger.LogInformation("Found {Count} candidate facilities for transfer {TransferId}", candidates.Count, transferRequestId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error processing shortage redistribution bridge for alert {AlertId}", shortageAlertId);
        }
    }
}

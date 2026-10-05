namespace MediStock.Api.Controllers;

using MediStock.Api.Common;
using MediStock.Api.Features.Inventory.Services;
using MediStock.Api.Features.Redistribution.DTOs;
using MediStock.Api.Features.Redistribution.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

/// <summary>
/// Redistribution transfers: CRUD plus the lifecycle. Redistribution vertical (Member 3).
///
/// Two actors, as in the redistribution design: store officers raise, dispatch and
/// receive transfers; facility managers propose sources, approve, reject, reserve and
/// cancel. Admins can do both.
/// </summary>
[ApiController]
[Route("api/transfers")]
[Authorize]
[Produces("application/json")]
public class TransferController : ControllerBase
{
    private const string AnyStaff = $"{Constants.Roles.StoreOfficer},{Constants.Roles.FacilityManager},{Constants.Roles.Admin}";
    private const string Managers = $"{Constants.Roles.FacilityManager},{Constants.Roles.Admin}";

    private readonly TransferService _transfers;
    private readonly MediStock.Api.Infrastructure.AI.AgentServiceClient _agent;

    public TransferController(TransferService transfers, MediStock.Api.Infrastructure.AI.AgentServiceClient agent)
    {
        _transfers = transfers;
        _agent = agent;
    }

    /// <summary>
    /// Asks the redistribution agent to recommend a source. Advisory: it proposes
    /// nothing and changes nothing; a manager acts on the recommendation.
    /// </summary>
    [HttpPost("{id:guid}/agent")]
    [Authorize(Roles = Managers)]
    public async Task<IActionResult> RunAgent(Guid id, [FromBody] TransferActionRequest? request, CancellationToken ct = default)
    {
        try
        {
            await _transfers.GetAsync(id, ct); // 404 before the agent is ever called
        }
        catch (TransferException ex)
        {
            return Error(ex.StatusCode, ex.Code, ex.Message);
        }

        var result = await _agent.RunRedistributionAsync(id, request?.Reason, ct);

        return result is null
            ? Error(StatusCodes.Status503ServiceUnavailable, "AGENT_UNAVAILABLE",
                "The agent service is not running or refused the request. No recommendation was produced and nothing was changed.")
            : Ok(new ApiResponse<System.Text.Json.JsonElement>(result.Value));
    }

    // ----- Read -----------------------------------------------------------

    [HttpGet]
    [Authorize(Roles = AnyStaff)]
    public Task<IActionResult> List(
        [FromQuery] string? status,
        [FromQuery] string? search,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken ct = default) =>
        Run(() => _transfers.ListAsync(status, search, page, pageSize, ct));

    [HttpGet("summary")]
    [Authorize(Roles = AnyStaff)]
    public Task<IActionResult> Summary(CancellationToken ct = default) => Run(() => _transfers.SummaryAsync(ct));

    [HttpGet("{id:guid}")]
    [Authorize(Roles = AnyStaff)]
    public Task<IActionResult> Get(Guid id, CancellationToken ct = default) => Run(() => _transfers.GetAsync(id, ct));

    [HttpGet("{id:guid}/candidates")]
    [Authorize(Roles = AnyStaff)]
    public Task<IActionResult> Candidates(Guid id, CancellationToken ct = default) => Run(() => _transfers.CandidatesAsync(id, ct));

    [HttpGet("{id:guid}/route")]
    [Authorize(Roles = AnyStaff)]
    public Task<IActionResult> Route(Guid id, CancellationToken ct = default) => Run(() => _transfers.RouteAsync(id, ct));

    // ----- Create / update / delete (soft) ---------------------------------

    [HttpPost]
    [Authorize(Roles = AnyStaff)]
    public Task<IActionResult> Create([FromBody] CreateTransferRequest request, CancellationToken ct = default) =>
        Run(() => _transfers.CreateAsync(request, ct), created: true);

    [HttpPut("{id:guid}")]
    [Authorize(Roles = AnyStaff)]
    public Task<IActionResult> Update(Guid id, [FromBody] UpdateTransferRequest request, CancellationToken ct = default) =>
        Run(() => _transfers.UpdateAsync(id, request, ct));

    /// <summary>Soft delete: the transfer is Cancelled and its history kept.</summary>
    [HttpDelete("{id:guid}")]
    [Authorize(Roles = Managers)]
    public Task<IActionResult> Cancel(Guid id, [FromQuery] string? reason, CancellationToken ct = default) =>
        Run(() => _transfers.CancelAsync(id, reason, ct));

    // ----- Lifecycle -------------------------------------------------------

    [HttpPost("{id:guid}/submit")]
    [Authorize(Roles = AnyStaff)]
    public Task<IActionResult> Submit(Guid id, CancellationToken ct = default) => Run(() => _transfers.SubmitAsync(id, ct));

    [HttpPost("{id:guid}/propose")]
    [Authorize(Roles = Managers)]
    public Task<IActionResult> Propose(Guid id, [FromBody] ProposeSourceRequest request, CancellationToken ct = default) =>
        Run(() => _transfers.ProposeAsync(id, request, ct));

    [HttpPost("{id:guid}/approve")]
    [Authorize(Roles = Managers)]
    public Task<IActionResult> Approve(Guid id, [FromBody] TransferActionRequest? request, CancellationToken ct = default) =>
        Run(() => _transfers.ApproveAsync(id, request?.Reason, ct));

    [HttpPost("{id:guid}/reject")]
    [Authorize(Roles = Managers)]
    public Task<IActionResult> Reject(Guid id, [FromBody] TransferActionRequest? request, CancellationToken ct = default) =>
        Run(() => _transfers.RejectAsync(id, request?.Reason, ct));

    [HttpPost("{id:guid}/reserve")]
    [Authorize(Roles = Managers)]
    public Task<IActionResult> Reserve(Guid id, CancellationToken ct = default) => Run(() => _transfers.ReserveAsync(id, ct));

    [HttpPost("{id:guid}/dispatch")]
    [Authorize(Roles = AnyStaff)]
    public Task<IActionResult> Dispatch(Guid id, [FromBody] TransferActionRequest? request, CancellationToken ct = default) =>
        Run(() => _transfers.DispatchAsync(id, request?.Reason, ct));

    [HttpPost("{id:guid}/deliver")]
    [Authorize(Roles = AnyStaff)]
    public Task<IActionResult> Deliver(Guid id, [FromBody] TransferActionRequest? request, CancellationToken ct = default) =>
        Run(() => _transfers.DeliverAsync(id, request?.Reason, ct));

    // ----- Error mapping ---------------------------------------------------

    private async Task<IActionResult> Run<T>(Func<Task<T>> action, bool created = false)
    {
        try
        {
            var result = await action();
            var body = new ApiResponse<T>(result);
            return created ? StatusCode(StatusCodes.Status201Created, body) : Ok(body);
        }
        catch (TransferException ex)
        {
            return Error(ex.StatusCode, ex.Code, ex.Message);
        }
        catch (InventoryException ex)
        {
            // Raised by the Inventory vertical while reserving or moving stock.
            return Error(StatusCodes.Status409Conflict, ex.Code, ex.Message);
        }
    }

    private IActionResult Error(int status, string code, string message) =>
        StatusCode(status, new ErrorResponse
        {
            Error = new ErrorDetail
            {
                Code = code,
                Message = message,
                TraceId = HttpContext.TraceIdentifier,
            },
        });
}

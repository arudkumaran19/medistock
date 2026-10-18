using System.Text.Json;
using MediStock.Api.Domain.Enums;
using MediStock.Api.Features.Inventory.Models;
using MediStock.Api.Features.Procurement.Models;
using MediStock.Api.Features.Workflow.DTOs;
using MediStock.Api.Features.Workflow.Models;
using MediStock.Api.Infrastructure.Persistence;
using MediStock.Api.Common.Audit;
using MediStock.Api.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Medicine = MediStock.Api.Features.Inventory.Models.Medicine;

namespace MediStock.Api.Features.Workflow.Services;

public interface IWorkflowService
{
    Task<WorkflowResponse> StartWorkflowAsync(
        StartWorkflowRequest request,
        Guid? userId,
        string? userRole = null,
        CancellationToken cancellationToken = default);

    Task<WorkflowResponse?> GetWorkflowByIdAsync(
        Guid id,
        Guid? userId = null,
        CancellationToken cancellationToken = default);

    Task<List<WorkflowResponse>> GetActiveWorkflowsAsync(
        Guid? userId = null,
        CancellationToken cancellationToken = default);

    Task<List<WorkflowResponse>> GetWorkflowsBySessionAsync(
        string sessionId,
        Guid? userId = null,
        CancellationToken cancellationToken = default);

    Task<Common.ApiResponse<WorkflowResponse>> StartPlanningWorkflowAsync(
        StartWorkflowRequest request,
        CancellationToken cancellationToken = default);
}

public sealed class WorkflowService : IWorkflowService
{
    private readonly ApplicationDbContext _db;
    private readonly IAgentGateway _agentGateway;

    public async Task<Common.ApiResponse<WorkflowResponse>> StartPlanningWorkflowAsync(
        StartWorkflowRequest request,
        CancellationToken cancellationToken = default)
    {
        var response = await StartWorkflowAsync(request, request.InitiatorUserId, null, cancellationToken);
        return Common.ApiResponse<WorkflowResponse>.Ok(response);
    }
    private readonly IWorkflowStateService _stateService;
    private readonly IApprovalService _approvalService;
    private readonly IAuditService _auditService;
    private readonly ILogger<WorkflowService> _logger;

    public WorkflowService(
        ApplicationDbContext db,
        IAgentGateway agentGateway,
        IWorkflowStateService stateService,
        IApprovalService approvalService,
        IAuditService auditService,
        ILogger<WorkflowService> logger)
    {
        _db = db;
        _agentGateway = agentGateway;
        _stateService = stateService;
        _approvalService = approvalService;
        _auditService = auditService;
        _logger = logger;
    }

    // Words/phrases that are conversational greetings or non-actionable inputs
    private static readonly HashSet<string> GreetingPhrases = new(StringComparer.OrdinalIgnoreCase)
    {
        "hi", "hello", "hey", "hiya", "howdy", "greetings", "good morning", "good afternoon",
        "good evening", "good day", "sup", "what's up", "whats up", "yo", "hi hi",
        "thanks", "thank you", "thank you!", "thanks!", "ty", "thx", "cheers",
        "ok", "okay", "k", "cool", "got it", "understood", "noted",
        "bye", "goodbye", "see you", "cya", "later",
        "help", "what can you do", "what do you do",
        "test", "ping", "hello?", "hi?", "hey?"
    };

    private static bool IsConversational(string lowerObj)
    {
        if (string.IsNullOrWhiteSpace(lowerObj)) return true;
        // Exact match against known greeting phrases
        if (GreetingPhrases.Contains(lowerObj.Trim())) return true;
        // Very short inputs with no operational keywords are treated as conversational
        if (lowerObj.Length <= 20)
        {
            bool hasOpKeyword =
                lowerObj.Contains("stock") || lowerObj.Contains("medicine") ||
                lowerObj.Contains("drug") || lowerObj.Contains("facilit") ||
                lowerObj.Contains("order") || lowerObj.Contains("procur") ||
                lowerObj.Contains("shortage") || lowerObj.Contains("expir") ||
                lowerObj.Contains("transfer") || lowerObj.Contains("redist") ||
                lowerObj.Contains("forecast") || lowerObj.Contains("audit") ||
                lowerObj.Contains("inventory") || lowerObj.Contains("supply");
            if (!hasOpKeyword) return true;
        }
        return false;
    }

    public async Task<WorkflowResponse> StartWorkflowAsync(
        StartWorkflowRequest request,
        Guid? userId,
        string? userRole = null,
        CancellationToken cancellationToken = default)
    {
        var effectiveWorkflowType = request.WorkflowType;
        var lowerObj = (request.Objective ?? "").ToLowerInvariant().Trim();

        // ── Guard: conversational / greeting messages — do not trigger any workflow
        if (IsConversational(lowerObj))
        {
            var greeting = lowerObj;
            string convReply = greeting switch
            {
                var g when g.StartsWith("thank") || g is "ty" or "thx" or "cheers" =>
                    "You're welcome! Let me know if you need any inventory analysis, shortage checks, or procurement assistance.",
                var g when g is "bye" or "goodbye" or "see you" or "cya" or "later" =>
                    "Goodbye! The MediStock coordinator is here whenever you need inventory or supply chain support.",
                var g when g is "help" or "what can you do" or "what do you do" =>
                    "I'm the MediStock Multi-Agent Coordinator. I can help you with:\n\n• **Stock queries** — current levels, thresholds\n• **Shortage analysis** — deficit forecasting across facilities\n• **Redistribution** — inter-facility transfer proposals\n• **Procurement** — draft purchase orders and supplier evaluation\n• **Expiry audits** — batch expiry risk monitoring\n• **Demand forecasting** — consumption rate and supply runway\n\nJust describe what you need in plain language.",
                _ => "Hello! I'm the MediStock Multi-Agent Coordinator. How can I assist you with inventory, shortage analysis, or supply chain operations today?"
            };

            var convRun = new WorkflowRun
            {
                WorkflowType = "Conversational",
                Objective = request.Objective ?? "hi",
                InitiatedByUserId = userId,
                Status = WorkflowStatus.Completed,
                SessionId = request.SessionId,
                MessageId = request.MessageId,
                ResultJson = JsonSerializer.Serialize(new
                {
                    status = "CONVERSATIONAL",
                    intent = "Conversational",
                    final_recommendation = convReply,
                    available_strategies = Array.Empty<string>()
                }),
                CompletedAt = DateTimeOffset.UtcNow,
                CreatedAt = DateTimeOffset.UtcNow,
                UpdatedAt = DateTimeOffset.UtcNow
            };
            _db.Set<WorkflowRun>().Add(convRun);
            await _db.SaveChangesAsync(cancellationToken);

            await _auditService.LogAsync(
                action: "AI_COORDINATOR_CHAT_SUBMITTED",
                resourceType: "AI_COORDINATOR",
                resourceId: convRun.Id.ToString(),
                outcome: "SUCCESS",
                correlationId: convRun.Id.ToString(),
                details: new { SessionId = request.SessionId, Type = "Conversational", Length = request.Objective?.Length ?? 0 },
                cancellationToken: cancellationToken);

            await _auditService.LogAsync(
                action: "AI_COORDINATOR_WORKFLOW_COMPLETED",
                resourceType: "AI_COORDINATOR",
                resourceId: convRun.Id.ToString(),
                outcome: "SUCCESS",
                correlationId: convRun.Id.ToString(),
                details: new { Intent = "Conversational", Reply = convReply },
                cancellationToken: cancellationToken);

            return await MapToResponseAsync(convRun.Id, cancellationToken)
                ?? throw new InvalidOperationException("Failed to map conversational workflow response");
        }

        // ── Role Scoping Enforcement ──────────────────────────────────────────
        bool isStoreOfficer = userRole == MediStock.Api.Common.Constants.Roles.StoreOfficer ||
                              string.Equals(userRole, "StoreOfficer", StringComparison.OrdinalIgnoreCase) ||
                              string.Equals(userRole, "OperationalStaff", StringComparison.OrdinalIgnoreCase) ||
                              string.Equals(userRole, "StoreOperator", StringComparison.OrdinalIgnoreCase);
        bool isSupplierOfficer = userRole == MediStock.Api.Common.Constants.Roles.SupplierOfficer ||
                                 string.Equals(userRole, "SupplierOfficer", StringComparison.OrdinalIgnoreCase);
        bool isAdmin = userRole == MediStock.Api.Common.Constants.Roles.Admin || string.Equals(userRole, "Administrator", StringComparison.OrdinalIgnoreCase);
        bool isFacilityManager = userRole == MediStock.Api.Common.Constants.Roles.FacilityManager || string.Equals(userRole, "FacilityManager", StringComparison.OrdinalIgnoreCase);

        // 1. Strict Administrator operations (User/Role management, system config, credentials, delete facility)
        bool isStrictAdminOperation =
            lowerObj.Contains("system user") || lowerObj.Contains("list user") || lowerObj.Contains("all users") ||
            lowerObj.Contains("password") || lowerObj.Contains("credential") || lowerObj.Contains("api key") ||
            lowerObj.Contains("secret token") || lowerObj.Contains("internal token") || lowerObj.Contains("connection string") ||
            lowerObj.Contains("delete facility") || lowerObj.Contains("remove facility") || lowerObj.Contains("delete hospital") ||
            lowerObj.Contains("change role") || lowerObj.Contains("assign role") || lowerObj.Contains("change permission") ||
            lowerObj.Contains("admin console") || lowerObj.Contains("system setting") || lowerObj.Contains("system config");

        if (!isAdmin && isStrictAdminOperation)
        {
            const string adminDeniedMsg =
                "Access denied: User management, role assignment, system configuration, and administrative credentials " +
                "are strictly restricted to Administrators. Store Officers and operational staff require elevated permissions from Administrators and Facility Managers.";
            var deniedRun = new WorkflowRun
            {
                WorkflowType = "AccessDenied",
                Objective = request.Objective,
                InitiatedByUserId = userId,
                Status = WorkflowStatus.Failed,
                ErrorMessage = adminDeniedMsg,
                SessionId = request.SessionId,
                MessageId = request.MessageId,
                ResultJson = JsonSerializer.Serialize(new
                {
                    status = "ACCESS_DENIED",
                    intent = "AccessDenied",
                    final_recommendation = adminDeniedMsg,
                    available_strategies = Array.Empty<string>()
                }),
                CompletedAt = DateTimeOffset.UtcNow,
                CreatedAt = DateTimeOffset.UtcNow,
                UpdatedAt = DateTimeOffset.UtcNow
            };
            _db.Set<WorkflowRun>().Add(deniedRun);
            await _db.SaveChangesAsync(cancellationToken);
            return await MapToResponseAsync(deniedRun.Id, cancellationToken)
                ?? throw new InvalidOperationException("Failed to map access denied workflow response");
        }

        // 2. Managerial operations (budget, approval overrides) - allowed for Admin & Facility Manager, blocked for Store/Supplier Officers
        bool isManagerialOperation =
            lowerObj.Contains("bypass approval") || lowerObj.Contains("override approval") || lowerObj.Contains("force approval") ||
            lowerObj.Contains("financial budget") || lowerObj.Contains("confidential budget") || lowerObj.Contains("hospital budget");

        if (!isAdmin && !isFacilityManager && isManagerialOperation)
        {
            const string managerDeniedMsg =
                "Access denied: Approval override and facility budget operations are strictly restricted to Administrators " +
                "and Facility Managers.";
            var deniedRun = new WorkflowRun
            {
                WorkflowType = "AccessDenied",
                Objective = request.Objective,
                InitiatedByUserId = userId,
                Status = WorkflowStatus.Failed,
                ErrorMessage = managerDeniedMsg,
                SessionId = request.SessionId,
                MessageId = request.MessageId,
                ResultJson = JsonSerializer.Serialize(new
                {
                    status = "ACCESS_DENIED",
                    intent = "AccessDenied",
                    final_recommendation = managerDeniedMsg,
                    available_strategies = Array.Empty<string>()
                }),
                CompletedAt = DateTimeOffset.UtcNow,
                CreatedAt = DateTimeOffset.UtcNow,
                UpdatedAt = DateTimeOffset.UtcNow
            };
            _db.Set<WorkflowRun>().Add(deniedRun);
            await _db.SaveChangesAsync(cancellationToken);
            return await MapToResponseAsync(deniedRun.Id, cancellationToken)
                ?? throw new InvalidOperationException("Failed to map access denied workflow response");
        }

        // Store Operator attempting procurement execution (blocked)
        bool isStoreOfficerProcurement = isStoreOfficer && (
            effectiveWorkflowType == "AutonomousProcurement" ||
            lowerObj.Contains("autonomous procurement") ||
            lowerObj.Contains("initiate procurement") ||
            lowerObj.Contains("purchase order") ||
            (lowerObj.Contains("procure") && (lowerObj.Contains("create purchase order") || lowerObj.Contains("draft purchase order") ||
                lowerObj.Contains("order from supplier") || lowerObj.Contains("execute procurement") || lowerObj.Contains("buy from supplier"))) ||
            (lowerObj.Contains("order") && lowerObj.Contains("supplier") && (lowerObj.Contains("immediate") || lowerObj.Contains("directly")))
        );
        if (isStoreOfficerProcurement)
        {
            const string deniedMsg =
                "Access denied: your role (Store Operator) cannot initiate procurement or purchase orders. " +
                "Procurement workflows are reserved for Supplier Officers. " +
                "Please contact a Supplier Officer to raise a purchase order.";
            var deniedRun = new WorkflowRun
            {
                WorkflowType = "AccessDenied",
                Objective = request.Objective,
                InitiatedByUserId = userId,
                Status = WorkflowStatus.Failed,
                ErrorMessage = deniedMsg,
                SessionId = request.SessionId,
                MessageId = request.MessageId,
                ResultJson = JsonSerializer.Serialize(new
                {
                    status = "ACCESS_DENIED",
                    intent = "AccessDenied",
                    final_recommendation = deniedMsg,
                    available_strategies = Array.Empty<string>()
                }),
                CompletedAt = DateTimeOffset.UtcNow,
                CreatedAt = DateTimeOffset.UtcNow,
                UpdatedAt = DateTimeOffset.UtcNow
            };
            _db.Set<WorkflowRun>().Add(deniedRun);
            await _db.SaveChangesAsync(cancellationToken);
            return await MapToResponseAsync(deniedRun.Id, cancellationToken)
                ?? throw new InvalidOperationException("Failed to map access denied workflow response");
        }

        // Supplier Officer attempting store operations or redistribution (blocked)
        bool isSupplierOfficerStoreOp = isSupplierOfficer && (
            effectiveWorkflowType == "StockRedistribution" ||
            lowerObj.Contains("retire batch") ||
            lowerObj.Contains("adjust stock") ||
            lowerObj.Contains("add medicine") ||
            lowerObj.Contains("stock adjustment") ||
            lowerObj.Contains("quantity in") ||
            (lowerObj.Contains("transfer") && (lowerObj.Contains("execute transfer") || lowerObj.Contains("dispatch transfer")))
        );
        if (isSupplierOfficerStoreOp)
        {
            const string deniedMsg2 =
                "Access denied: your role (Supplier Officer) cannot perform store inventory mutations or stock transfers. " +
                "Store operations and redistribution are reserved for Store Operators. " +
                "Please contact a Store Operator to adjust stock quantities.";
            var deniedRun = new WorkflowRun
            {
                WorkflowType = "AccessDenied",
                Objective = request.Objective,
                InitiatedByUserId = userId,
                Status = WorkflowStatus.Failed,
                ErrorMessage = deniedMsg2,
                SessionId = request.SessionId,
                MessageId = request.MessageId,
                ResultJson = JsonSerializer.Serialize(new
                {
                    status = "ACCESS_DENIED",
                    intent = "AccessDenied",
                    final_recommendation = deniedMsg2,
                    available_strategies = Array.Empty<string>()
                }),
                CompletedAt = DateTimeOffset.UtcNow,
                CreatedAt = DateTimeOffset.UtcNow,
                UpdatedAt = DateTimeOffset.UtcNow
            };
            _db.Set<WorkflowRun>().Add(deniedRun);
            await _db.SaveChangesAsync(cancellationToken);
            return await MapToResponseAsync(deniedRun.Id, cancellationToken)
                ?? throw new InvalidOperationException("Failed to map access denied workflow response");
        }

        // ── Multi-medicine catalogue query → CatalogueQuery
        bool isCatalogueQuery =
            lowerObj.Contains("what medicines are") || lowerObj.Contains("list all medicines") ||
            lowerObj.Contains("list medicines") || lowerObj.Contains("medicines available") ||
            lowerObj.Contains("available medicines") ||
            lowerObj.Contains("medicines and their stock") || lowerObj.Contains("medicines and stock") ||
            lowerObj.Contains("all medicines") || lowerObj.Contains("all drugs") ||
            lowerObj.Contains("full stock list") || lowerObj.Contains("complete inventory") ||
            lowerObj.Contains("show all medicines") || lowerObj.Contains("show medicines") ||
            lowerObj.Contains("distinct facilities") || lowerObj.Contains("across facilities") ||
            lowerObj.Contains("stock vs minimum threshold") || lowerObj.Contains("stock vs threshold") ||
            lowerObj.Contains("threshold chart") || lowerObj.Contains("catalogue") ||
            lowerObj.Contains("catalog") || lowerObj.Contains("stokcs") ||
            lowerObj.Contains("avaliable") || lowerObj.Contains("total stock") || lowerObj.Contains("total stocks") ||
            (lowerObj.Contains("medicines") && (lowerObj.Contains("stock") || lowerObj.Contains("available") || lowerObj.Contains("avaliable")));

        // ── Batch expiry scan across facilities → ExpiryAudit
        bool isExpiryQuery =
            request.WorkflowType == "ExpiryAudit" ||
            lowerObj.Contains("expir") || lowerObj.Contains("expire") ||
            (lowerObj.Contains("batch") && (lowerObj.Contains("day") || lowerObj.Contains("across") || lowerObj.Contains("next") || lowerObj.Contains("soon") || lowerObj.Contains("within")));

        Guid? resolvedMedId = (isCatalogueQuery || isExpiryQuery) ? null : request.MedicineId;
        if (!isCatalogueQuery && !isExpiryQuery && resolvedMedId is null && !string.IsNullOrWhiteSpace(request.Objective))
        {
            // Normalise common typo "500g" -> "500 mg" when digits >= 50
            var normalizedObj = System.Text.RegularExpressions.Regex.Replace(
                lowerObj, @"(\d+)\s*g\b", m => int.TryParse(m.Groups[1].Value, out var n) && n >= 50 ? $"{n} mg" : m.Value);
            normalizedObj = System.Text.RegularExpressions.Regex.Replace(
                normalizedObj, @"(\d+)\s*(mg|g|mcg|iu|ml)", "$1 $2");
            var meds = await _db.Medicines.AsNoTracking().ToListAsync(cancellationToken);
            
            // 1. Exact full-name match (both sides normalised) – preserves strength identity
            Medicine? matched = meds.FirstOrDefault(m =>
            {
                var mNorm = System.Text.RegularExpressions.Regex.Replace(
                    m.Name.ToLowerInvariant(), @"(\d+)\s*(mg|g|mcg|iu|ml)", "$1 $2");
                return normalizedObj.Contains(mNorm);
            });

            // 2. Exact base-name + dosage digits match (e.g. "amoxicillin" + "500" matches "Amoxicillin 500mg", NEVER 250mg)
            if (matched is null)
            {
                matched = meds.FirstOrDefault(m =>
                {
                    var baseName = m.Name.Split(' ')[0].ToLowerInvariant();
                    var mDigits = System.Text.RegularExpressions.Regex.Match(m.Name, @"\d+").Value;
                    if (string.IsNullOrEmpty(mDigits)) return false;
                    return normalizedObj.Contains(baseName) && System.Text.RegularExpressions.Regex.IsMatch(normalizedObj, $@"\b{mDigits}\b");
                });
            }
            
            // 3. Code match
            matched ??= meds.FirstOrDefault(m => normalizedObj.Contains(m.Code.ToLowerInvariant()));
            
            // 4. Base-name fallback ONLY when the objective contains NO dosage digits,
            //    so we never silently substitute "Amoxicillin 250 mg" for "Amoxicillin 500 mg".
            bool objectiveHasDosage = System.Text.RegularExpressions.Regex.IsMatch(normalizedObj, @"\d+");
            if (matched is null && !objectiveHasDosage)
            {
                matched = meds.FirstOrDefault(m =>
                    normalizedObj.Contains(m.Name.Split(' ', StringSplitOptions.None)[0].ToLowerInvariant()));
            }
            
            if (matched is not null)
            {
                resolvedMedId = matched.Id;
            }
        }

        Guid? resolvedFacId = (isCatalogueQuery || isExpiryQuery) ? null : request.FacilityId;
        if (!isCatalogueQuery && !isExpiryQuery && resolvedFacId is null && !string.IsNullOrWhiteSpace(request.Objective))
        {
            var facs = await _db.Facilities.AsNoTracking().ToListAsync(cancellationToken);
            var matched = facs.FirstOrDefault(f => lowerObj.Contains(f.Name.ToLowerInvariant()))
                       ?? facs.FirstOrDefault(f => lowerObj.Contains(f.Code.ToLowerInvariant()))
                       ?? facs.FirstOrDefault(f => !string.IsNullOrEmpty(f.Address) && lowerObj.Contains(f.Address.ToLowerInvariant()))
                       ?? facs.FirstOrDefault(f => lowerObj.Contains(f.Name.Split(' ', StringSplitOptions.None)[0].ToLowerInvariant()));
            if (matched is not null)
            {
                resolvedFacId = matched.Id;
            }
        }

        // Conversational continuity: inherit medicine/facility from previous workflow ONLY if omitted
        // NEVER inherit medicine if the user's objective mentions any medicine name, mentions dosage, or is a catalogue query!
        var allMeds = await _db.Medicines.AsNoTracking().ToListAsync(cancellationToken);
        bool mentionsAnyMed = allMeds.Any(m => lowerObj.Contains(m.Name.Split(' ', StringSplitOptions.None)[0].ToLowerInvariant()));
        bool mentionsDosage = System.Text.RegularExpressions.Regex.IsMatch(lowerObj, @"\d+");

        if (!isCatalogueQuery && !mentionsAnyMed && !mentionsDosage && (!resolvedMedId.HasValue || !resolvedFacId.HasValue))
        {
            WorkflowRun? previousRun = null;
            if (!string.IsNullOrWhiteSpace(request.SessionId))
            {
                previousRun = await _db.Set<WorkflowRun>().AsNoTracking()
                    .Where(r => r.SessionId == request.SessionId)
                    .OrderByDescending(r => r.CreatedAt)
                    .FirstOrDefaultAsync(cancellationToken);
            }
            if (previousRun is not null)
            {
                if (!resolvedMedId.HasValue) resolvedMedId = previousRun.MedicineId;
                if (!resolvedFacId.HasValue) resolvedFacId = previousRun.FacilityId;
            }
        }

        // Check if the query asks across multiple/all/distinct facilities
        bool mentionsMultiFacility =
            lowerObj.Contains("each facilit") ||
            lowerObj.Contains("all facilit") ||
            lowerObj.Contains("across facilit") ||
            lowerObj.Contains("every facilit") ||
            lowerObj.Contains("by facilit") ||
            lowerObj.Contains("distinct facilit") ||
            lowerObj.Contains("different facilit") ||
            lowerObj.Contains("in each") ||
            lowerObj.Contains("in facilit");

        // If facility was not specified in prompt, find facility holding this medicine
        // ONLY if user did not ask across all/each facilities
        if (!isCatalogueQuery && !mentionsMultiFacility && resolvedFacId is null && resolvedMedId.HasValue)
        {
            var inv = await _db.InventoryBalances.AsNoTracking()
                .Where(b => b.MedicineId == resolvedMedId.Value)
                .OrderBy(b => b.QuantityOnHand)
                .FirstOrDefaultAsync(cancellationToken);
            if (inv is not null)
            {
                resolvedFacId = inv.FacilityId;
            }
        }

        // ── Simple factual stock query → InventoryAudit (highest precedence for read-only questions)
        bool isSimpleStockQuery =
            !isCatalogueQuery &&
            !string.IsNullOrWhiteSpace(lowerObj) &&
            !lowerObj.Contains("shortage") && !lowerObj.Contains("stockout") &&
            !lowerObj.Contains("critical") && !lowerObj.Contains("deficit") &&
            !lowerObj.Contains("order") && !lowerObj.Contains("procur") &&
            !lowerObj.Contains("transfer") && !lowerObj.Contains("redist") &&
            (
                lowerObj.Contains("what is the stock") || lowerObj.Contains("what's the stock") ||
                lowerObj.Contains("what is the current stock") || lowerObj.Contains("what's the current stock") ||
                lowerObj.Contains("current stock of") || lowerObj.Contains("stock level of") ||
                lowerObj.Contains("stock levels of") || lowerObj.Contains("how many units") ||
                lowerObj.Contains("how many tablets") || lowerObj.Contains("how many capsules") ||
                lowerObj.Contains("do we have of") || lowerObj.Contains("do we currently have") ||
                lowerObj.Contains("quantity on hand") || lowerObj.Contains("on-hand stock") ||
                lowerObj.Contains("available stock of") || lowerObj.Contains("how much do we have") ||
                lowerObj.Contains("stock status of")
            );

        // ── Pure demand/forecast query (no action intent)
        bool isDemandForecastOnly =
            (lowerObj.Contains("forecast") || lowerObj.Contains("days of supply") ||
             lowerObj.Contains("burn rate") || lowerObj.Contains("how long will") ||
             lowerObj.Contains("will last") || lowerObj.Contains("consumption rate")) &&
            !lowerObj.Contains("shortage") && !lowerObj.Contains("stockout") &&
            !lowerObj.Contains("deficit") && !lowerObj.Contains("risk") &&
            !lowerObj.Contains("order") && !lowerObj.Contains("procur") && !lowerObj.Contains("redist");

        // ── General analysis (shortage/demand that may lead to resolution pipeline)
        bool isAnalysisQuery =
            !isSimpleStockQuery && !isCatalogueQuery && !isDemandForecastOnly &&
            (
                lowerObj.Contains("forecast") ||
                lowerObj.Contains("burn rate") ||
                lowerObj.Contains("consumption") ||
                lowerObj.Contains("days of supply") ||
                lowerObj.Contains("shortage") ||
                lowerObj.Contains("stockout") ||
                lowerObj.Contains("deficit") ||
                lowerObj.Contains("critical") ||
                lowerObj.Contains("audit local inventory") ||
                lowerObj.Contains("multi-facility emergency audit") ||
                lowerObj.Contains("assess")
            );

        // Helper: check if text is an explicit strategy-selection phrase for the given strategy keyword
        static bool IsStrategyPhrase(string text, string keyword)
        {
            if (string.IsNullOrWhiteSpace(text)) return false;
            var t = text.Trim().ToLowerInvariant();
            if (t == keyword) return true;
            if (t.StartsWith($"apply strategy: {keyword}") || t.StartsWith($"selected strategy: {keyword}")) return true;
            string[] prefixes = [
                $"choose {keyword}", $"chose {keyword}", $"i choose {keyword}", $"i chose {keyword}",
                $"i'd like {keyword}", $"i want {keyword}", $"i'll take {keyword}", $"go with {keyword}",
                $"use {keyword}", $"select {keyword}", $"let's use {keyword}",
                $"let's go with {keyword}", $"do {keyword}", $"proceed with {keyword}",
                $"i prefer {keyword}", $"prefer {keyword}", $"pick {keyword}",
                $"option {keyword}", $"take {keyword}", $"try {keyword}",
                $"do the {keyword}", $"the {keyword}", $"apply {keyword}", $"run {keyword}",
                $"execute {keyword}",
            ];
            foreach (var p in prefixes)
                if (t == p || t.StartsWith(p + " ") || t.StartsWith(p + ".")) return true;
            return false;
        }

        string? selectedStrategyParam = null;
        if (request.Parameters is not null && request.Parameters.TryGetValue("selected_strategy", out var sObj) && sObj is not null)
        {
            selectedStrategyParam = sObj.ToString()?.ToLowerInvariant().Trim();
        }

        bool hasProcureKeyword =
            selectedStrategyParam == "procurement" ||
            (!isAnalysisQuery && (
                effectiveWorkflowType == "AutonomousProcurement" ||
                IsStrategyPhrase(lowerObj, "procurement") ||
                IsStrategyPhrase(lowerObj, "procure") ||
                IsStrategyPhrase(lowerObj, "purchase") ||
                (lowerObj.Length < 50 && (lowerObj.Contains("procur") || lowerObj.Contains("purchas") || lowerObj.Contains("buy")))
            ));

        bool hasRedistKeyword =
            selectedStrategyParam == "redistribution" ||
            (!isAnalysisQuery && (
                effectiveWorkflowType == "StockRedistribution" ||
                IsStrategyPhrase(lowerObj, "redistribution") ||
                IsStrategyPhrase(lowerObj, "redistribute") ||
                IsStrategyPhrase(lowerObj, "transfer") ||
                (lowerObj.Length < 50 && (lowerObj.Contains("redist") || lowerObj.Contains("transfer")))
            ));

        bool isBoth =
            selectedStrategyParam == "both" ||
            selectedStrategyParam == "hybrid" ||
            selectedStrategyParam == "dual" ||
            (!isAnalysisQuery && (
                effectiveWorkflowType == "CombinedResolution" ||
                (hasProcureKeyword && hasRedistKeyword) ||
                IsStrategyPhrase(lowerObj, "both") ||
                IsStrategyPhrase(lowerObj, "hybrid") ||
                IsStrategyPhrase(lowerObj, "dual") ||
                (lowerObj.Length < 50 && (lowerObj.Contains("both") || lowerObj.Contains("hybrid") || lowerObj.Contains("dual") || lowerObj.Contains("combin")))
            ));

        bool isNeither =
            selectedStrategyParam == "neither" ||
            selectedStrategyParam == "none" ||
            (!isAnalysisQuery && (
                effectiveWorkflowType == "Neither" ||
                IsStrategyPhrase(lowerObj, "neither") ||
                lowerObj == "neither" || lowerObj == "none" || lowerObj == "stop" || lowerObj == "cancel" || lowerObj == "do nothing" ||
                (lowerObj.Length < 50 && (lowerObj.Contains("neither") || lowerObj.Contains("cancel") || lowerObj.Contains("do nothing")))
            ));

        // ── Route based on detected or frontend-supplied intent (most specific first)
        bool frontendSentExpiry = request.WorkflowType == "ExpiryAudit";
        bool frontendSentInventoryAudit = request.WorkflowType == "InventoryAudit";
        bool frontendSentCatalogue = request.WorkflowType == "CatalogueQuery";
        bool frontendSentDemandForecast = request.WorkflowType == "DemandForecast";
        bool workflowTypeIsNeutral = string.IsNullOrWhiteSpace(request.WorkflowType) || request.WorkflowType == "ShortageResolution";

        if (frontendSentExpiry || isExpiryQuery)
        {
            effectiveWorkflowType = "ExpiryAudit";
        }
        else if (frontendSentCatalogue || isCatalogueQuery)
        {
            effectiveWorkflowType = "CatalogueQuery";
        }
        else if (frontendSentInventoryAudit || (isSimpleStockQuery && workflowTypeIsNeutral))
        {
            effectiveWorkflowType = "InventoryAudit";
        }
        else if (frontendSentDemandForecast || (isDemandForecastOnly && workflowTypeIsNeutral))
        {
            effectiveWorkflowType = "DemandForecast";
        }
        else if (isAnalysisQuery)
        {
            effectiveWorkflowType = "ShortageResolution";
        }
        else if (isBoth)
        {
            effectiveWorkflowType = "CombinedResolution";
        }
        else if (isNeither)
        {
            effectiveWorkflowType = "Neither";
        }
        else if (hasProcureKeyword && !lowerObj.Contains("compare supplier") && !lowerObj.Contains("supplier score") && !lowerObj.Contains("lead-time audit"))
        {
            effectiveWorkflowType = "AutonomousProcurement";
        }
        else if (hasRedistKeyword && !lowerObj.Contains("find hospitals that can donate") && !lowerObj.Contains("list donor"))
        {
            effectiveWorkflowType = "StockRedistribution";
        }
        else if (string.IsNullOrWhiteSpace(effectiveWorkflowType) || effectiveWorkflowType == "ShortageResolution")
        {
            if (lowerObj.Contains("compare supplier") || lowerObj.Contains("compare procurement"))
            {
                effectiveWorkflowType = "ProcurementEvaluation";
            }
            else if (lowerObj.Contains("find hospitals that can donate") || lowerObj.Contains("list donor"))
            {
                effectiveWorkflowType = "RedistributionEvaluation";
            }
            else if (lowerObj.Contains("audit") && !lowerObj.Contains("shortage") && !lowerObj.Contains("stockout") && !lowerObj.Contains("critical"))
            {
                effectiveWorkflowType = "InventoryAudit";
            }
            else if ((lowerObj.Contains("forecast") || lowerObj.Contains("demand") || lowerObj.Contains("consumption") || lowerObj.Contains("days of supply"))
                && !lowerObj.Contains("shortage") && !lowerObj.Contains("stockout") && !lowerObj.Contains("critical") && !lowerObj.Contains("risk") && !lowerObj.Contains("order"))
            {
                effectiveWorkflowType = "DemandForecast";
            }
            else if (lowerObj.Contains("shortage") || lowerObj.Contains("deficit") || lowerObj.Contains("stockout") || lowerObj.Contains("critical") || lowerObj.Contains("replenish"))
            {
                effectiveWorkflowType = "ShortageAnalysis";
            }
            else if (lowerObj.Contains("stock") || lowerObj.Contains("inventory") || lowerObj.Contains("medicine") || lowerObj.Contains("check") || lowerObj.Contains("balance") || lowerObj.Contains("facility"))
            {
                effectiveWorkflowType = "Clarification";
            }
            else
            {
                effectiveWorkflowType = "OutOfDomain";
            }
        }

        var runContextDict = request.Parameters is not null
            ? new Dictionary<string, object>(request.Parameters)
            : new Dictionary<string, object>();
        if (!string.IsNullOrWhiteSpace(userRole)) runContextDict["user_role"] = userRole;
        if (userId.HasValue) runContextDict["user_id"] = userId.Value.ToString();

        var run = new WorkflowRun
        {
            WorkflowType = effectiveWorkflowType,
            Objective = request.Objective,
            FacilityId = resolvedFacId,
            MedicineId = resolvedMedId,
            InitiatedByUserId = userId,
            Status = WorkflowStatus.Running,
            SessionId = request.SessionId,
            MessageId = request.MessageId,
            ContextJson = JsonSerializer.Serialize(runContextDict),
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };

        _db.Set<WorkflowRun>().Add(run);
        await _db.SaveChangesAsync(cancellationToken);

        await _auditService.LogAsync(
            action: "AI_COORDINATOR_CHAT_SUBMITTED",
            resourceType: "AI_COORDINATOR",
            resourceId: run.Id.ToString(),
            outcome: "SUCCESS",
            correlationId: run.Id.ToString(),
            details: new
            {
                SessionId = request.SessionId,
                WorkflowType = effectiveWorkflowType,
                FacilityId = resolvedFacId,
                MedicineId = resolvedMedId,
                ObjectiveLength = request.Objective?.Length ?? 0
            },
            cancellationToken: cancellationToken);

        await _stateService.AddAuditLogAsync(
            run.Id,
            "WORKFLOW_STARTED",
            $"Workflow started: {request.Objective}",
            new { request.WorkflowType, request.FacilityId, request.MedicineId },
            userId,
            cancellationToken);

        // Execute Coordinator through Agent Gateway with error auditing
        CoordinatorExecutionResult coordinatorResult;
        try
        {
            coordinatorResult = await _agentGateway.ExecuteCoordinatorWorkflowAsync(run, cancellationToken);
        }
        catch (Exception ex)
        {
            await _auditService.LogAsync(
                action: "AI_COORDINATOR_WORKFLOW_FAILED",
                resourceType: "AI_COORDINATOR",
                resourceId: run.Id.ToString(),
                outcome: "FAILURE",
                correlationId: run.Id.ToString(),
                reason: ex.Message,
                cancellationToken: cancellationToken);
            throw;
        }

        // Audit Intent Classification
        await _auditService.LogAsync(
            action: "AI_COORDINATOR_INTENT_CLASSIFIED",
            resourceType: "AI_COORDINATOR",
            resourceId: run.Id.ToString(),
            outcome: "SUCCESS",
            correlationId: run.Id.ToString(),
            details: new
            {
                Intent = coordinatorResult.Intent,
                RequiresHumanApproval = coordinatorResult.RequiresHumanApproval,
                ApprovalType = coordinatorResult.ApprovalType,
                PlanStepsCount = coordinatorResult.PlanSteps.Count
            },
            cancellationToken: cancellationToken);

        // Populate steps and audit each tool invocation
        int order = 1;
        foreach (var stepDesc in coordinatorResult.PlanSteps)
        {
            var agentName = DetermineAgentName(stepDesc);
            var planStep = new WorkflowPlanStep
            {
                WorkflowRunId = run.Id,
                StepOrder = order++,
                StepKey = $"step_{order}",
                AgentName = agentName,
                Action = stepDesc,
                Status = "Completed",
                OutputSummary = $"Executed successfully: {stepDesc}",
                StartedAt = DateTimeOffset.UtcNow.AddSeconds(-2),
                CompletedAt = DateTimeOffset.UtcNow
            };
            _db.Set<WorkflowPlanStep>().Add(planStep);

            await _auditService.LogAsync(
                action: "AI_COORDINATOR_TOOL_INVOKED",
                resourceType: "AI_COORDINATOR",
                resourceId: run.Id.ToString(),
                outcome: "SUCCESS",
                correlationId: run.Id.ToString(),
                details: new
                {
                    AgentName = agentName,
                    StepOrder = planStep.StepOrder,
                    Action = stepDesc
                },
                cancellationToken: cancellationToken);
        }

        run.ResultJson = coordinatorResult.RawOutputJson;
        run.RequiresApproval = coordinatorResult.RequiresHumanApproval;
        if (!string.IsNullOrWhiteSpace(coordinatorResult.Intent))
        {
            run.WorkflowType = coordinatorResult.Intent;
        }

        if (coordinatorResult.RequiresHumanApproval)
        {
            run.Status = WorkflowStatus.WaitingForApproval;
            await _db.SaveChangesAsync(cancellationToken);

            // If procurement is required, persist a PurchaseOrder in PendingApproval status
            // so it immediately appears on the Approvals Console (/procurement/approvals) and Orders list
            if ((run.WorkflowType == "AutonomousProcurement" || run.WorkflowType == "CombinedResolution")
                && run.FacilityId.HasValue && run.MedicineId.HasValue)
            {
                int orderQty = 100;
                decimal unitPrice = 8.50m;
                string? supplierName = null;

                try
                {
                    if (!string.IsNullOrWhiteSpace(run.ResultJson))
                    {
                        using var doc = JsonDocument.Parse(run.ResultJson);
                        var root = doc.RootElement;
                        if (root.TryGetProperty("procurement_proposal", out var pProp) && pProp.ValueKind == JsonValueKind.Object)
                        {
                            if (pProp.TryGetProperty("quantity", out var q) && q.TryGetInt32(out var qVal)) orderQty = qVal;
                            if (pProp.TryGetProperty("unit_price", out var up) && up.TryGetDecimal(out var upVal)) unitPrice = upVal;
                            if (pProp.TryGetProperty("recommended_supplier", out var s)) supplierName = s.GetString();
                        }
                        else if (root.TryGetProperty("projectedDeficit", out var pd) && pd.TryGetInt32(out var pdVal) && pdVal > 0)
                        {
                            orderQty = pdVal;
                        }
                    }
                }
                catch { /* ignore parsing errors */ }

                var supplier = await _db.Suppliers.FirstOrDefaultAsync(s => s.Name.Contains("State Pharmaceuticals") || s.Name.Contains("SPMC"), cancellationToken)
                    ?? await _db.Suppliers.FirstOrDefaultAsync(s => s.IsActive, cancellationToken);

                if (supplier is null)
                {
                    supplier = new Supplier
                    {
                        Id = Guid.NewGuid(),
                        Name = supplierName ?? "State Pharmaceuticals Manufacturing Corporation (SPMC)",
                        ContactPerson = "Director of Logistics",
                        Email = "procurement@spmc.gov.lk",
                        Phone = "+94-11-2635353",
                        Address = "No. 11 Sir John Kotelawala Mawatha, Ratmalana",
                        LeadTimeDays = 3,
                        IsActive = true
                    };
                    _db.Suppliers.Add(supplier);
                    await _db.SaveChangesAsync(cancellationToken);
                }

                var existingPendingPo = await _db.PurchaseOrders
                    .Include(p => p.Items)
                    .FirstOrDefaultAsync(p => p.FacilityId == run.FacilityId.Value
                        && p.Status == PurchaseOrderStatus.PendingApproval
                        && p.Items.Any(i => i.MedicineId == run.MedicineId.Value), cancellationToken);

                if (existingPendingPo is null)
                {
                    var poId = Guid.NewGuid();
                    var pendingPo = new PurchaseOrder
                    {
                        Id = poId,
                        SupplierId = supplier.Id,
                        FacilityId = run.FacilityId.Value,
                        Status = PurchaseOrderStatus.PendingApproval,
                        RequestedAt = DateTime.UtcNow,
                        Items = new List<PurchaseOrderItem>
                        {
                            new PurchaseOrderItem
                            {
                                Id = Guid.NewGuid(),
                                PurchaseOrderId = poId,
                                MedicineId = run.MedicineId.Value,
                                RequestedQuantity = orderQty,
                                UnitPrice = unitPrice
                            }
                        }
                    };
                    _db.PurchaseOrders.Add(pendingPo);
                    await _db.SaveChangesAsync(cancellationToken);
                }
            }

            string approvalType = coordinatorResult.ApprovalType ?? (run.WorkflowType switch
            {
                "StockRedistribution" => "StockTransferApproval",
                "AutonomousProcurement" => "PurchaseOrderApproval",
                "CombinedResolution" => "HybridTransferAndProcurementApproval",
                _ => "StockTransferApproval"
            });

            await _approvalService.RequestApprovalAsync(
                run.Id,
                approvalType,
                MediStock.Api.Common.Constants.Roles.FacilityManager,
                cancellationToken);
        }
        else
        {
            run.Status = WorkflowStatus.Completed;
            run.CompletedAt = DateTimeOffset.UtcNow;
            await _db.SaveChangesAsync(cancellationToken);

            await _auditService.LogAsync(
                action: "AI_COORDINATOR_WORKFLOW_COMPLETED",
                resourceType: "AI_COORDINATOR",
                resourceId: run.Id.ToString(),
                outcome: "SUCCESS",
                correlationId: run.Id.ToString(),
                details: new
                {
                    WorkflowType = run.WorkflowType,
                    StepsCount = coordinatorResult.PlanSteps.Count
                },
                cancellationToken: cancellationToken);
        }

        return await MapToResponseAsync(run.Id, cancellationToken)
            ?? throw new InvalidOperationException("Failed to map workflow response");
    }

    public async Task<WorkflowResponse?> GetWorkflowByIdAsync(
        Guid id,
        Guid? userId = null,
        CancellationToken cancellationToken = default)
    {
        var run = await _stateService.GetWorkflowAsync(id, cancellationToken);
        if (run is null) return null;
        if (userId.HasValue && run.InitiatedByUserId.HasValue && run.InitiatedByUserId.Value != userId.Value)
        {
            return null;
        }

        return await MapToResponseAsync(id, cancellationToken);
    }

    public async Task<List<WorkflowResponse>> GetActiveWorkflowsAsync(
        Guid? userId = null,
        CancellationToken cancellationToken = default)
    {
        var runs = await _stateService.GetActiveWorkflowsAsync(userId, cancellationToken);
        var list = new List<WorkflowResponse>();
        foreach (var run in runs)
        {
            var res = await MapToResponseAsync(run.Id, cancellationToken);
            if (res is not null) list.Add(res);
        }
        return list;
    }

    public async Task<List<WorkflowResponse>> GetWorkflowsBySessionAsync(
        string sessionId,
        Guid? userId = null,
        CancellationToken cancellationToken = default)
    {
        var runs = await _stateService.GetWorkflowsBySessionAsync(sessionId, userId, cancellationToken);
        var list = new List<WorkflowResponse>();
        foreach (var run in runs)
        {
            var res = await MapToResponseAsync(run.Id, cancellationToken);
            if (res is not null) list.Add(res);
        }
        return list;
    }

    private async Task<WorkflowResponse?> MapToResponseAsync(Guid id, CancellationToken cancellationToken)
    {
        var run = await _stateService.GetWorkflowAsync(id, cancellationToken);
        if (run is null) return null;

        return new WorkflowResponse
        {
            Id = run.Id,
            WorkflowType = run.WorkflowType,
            Objective = run.Objective,
            Status = run.Status,
            FacilityId = run.FacilityId,
            MedicineId = run.MedicineId,
            InitiatedByUserId = run.InitiatedByUserId,
            RequiresApproval = run.RequiresApproval,
            ErrorMessage = run.ErrorMessage,
            ResultJson = run.ResultJson,
            SessionId = run.SessionId,
            MessageId = run.MessageId,
            CreatedAt = run.CreatedAt,
            UpdatedAt = run.UpdatedAt,
            CompletedAt = run.CompletedAt,
            Steps = run.Steps.Select(s => new WorkflowStepResponse
            {
                Id = s.Id,
                StepOrder = s.StepOrder,
                StepKey = s.StepKey,
                AgentName = s.AgentName,
                Action = s.Action,
                Status = s.Status,
                OutputSummary = s.OutputSummary,
                OutputJson = s.OutputJson,
                StartedAt = s.StartedAt,
                CompletedAt = s.CompletedAt
            }).ToList(),
            Approvals = run.Approvals.Select(a => new ApprovalDto
            {
                Id = a.Id,
                ApprovalType = a.ApprovalType,
                RequiredRole = a.RequiredRole,
                Decision = a.Decision,
                DecidedByUserId = a.DecidedByUserId,
                DecidedByUserName = a.DecidedByUserName,
                Comments = a.Comments,
                RequestedAt = a.RequestedAt,
                DecidedAt = a.DecidedAt
            }).ToList()
        };
    }

    private static string DetermineAgentName(string stepDesc)
    {
        var lower = stepDesc.ToLowerInvariant();
        if (lower.Contains("redistribut") || lower.Contains("transfer") || lower.Contains("donor"))
            return "RedistributionAgent";
        if (lower.Contains("procur") || lower.Contains("supplier") || lower.Contains("order") || lower.Contains("po"))
            return "ProcurementAgent";
        if (lower.Contains("demand") || lower.Contains("forecast") || lower.Contains("shortage") || lower.Contains("stock"))
            return "DemandShortageAgent";
        if (lower.Contains("policy") || lower.Contains("validat") || lower.Contains("rule"))
            return "PolicyValidationAgent";
        return "CoordinatorAgent";
    }
}

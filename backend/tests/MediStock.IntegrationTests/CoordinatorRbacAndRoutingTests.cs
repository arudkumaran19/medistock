namespace MediStock.IntegrationTests;

using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;
using MediStock.Api.Common;
using MediStock.Api.Controllers;
using MediStock.Api.Domain.Enums;
using MediStock.Api.Features.Workflow.DTOs;
using MediStock.Api.Features.Workflow.Services;
using MediStock.Api.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

/// <summary>
/// Integration and authorization tests for:
///   1. WorkflowController Coordinator RBAC (authenticated, forbidden roles → 403, allowed roles → 200/201)
///   2. MedicinesController / InventoryController AddMedicineAndExpiry policy
///   3. WorkflowService in-process role-scoping enforcement (access-denied short-circuits)
///   4. WorkflowService non-shortage routing invariant (ambiguous / out-of-domain must not silently
///      become ShortageAnalysis — the most critical routing regression guard)
/// </summary>
public class CoordinatorRbacAndRoutingTests : IClassFixture<DemandApiFactory>
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    {
        Converters = { new System.Text.Json.Serialization.JsonStringEnumConverter() }
    };
    private readonly DemandApiFactory _factory;

    public CoordinatorRbacAndRoutingTests(DemandApiFactory factory) => _factory = factory;

    // -----------------------------------------------------------------------
    // 1. Coordinator RBAC — HTTP layer
    // -----------------------------------------------------------------------

    [Fact]
    public async Task StartWorkflow_RejectsUnauthenticatedCaller()
    {
        var client = _factory.CreateClient();
        var response = await client.PostAsJsonAsync("/api/workflows", new StartWorkflowRequest
        {
            Objective = "Check inventory for Paracetamol",
            SessionId = "test-session-unauth"
        });

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task GetActiveWorkflows_RejectsUnauthenticatedCaller()
    {
        var client = _factory.CreateClient();
        var response = await client.GetAsync("/api/workflows");

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Theory]
    [InlineData(Constants.Roles.Admin)]
    [InlineData("Administrator")]
    [InlineData(Constants.Roles.FacilityManager)]
    [InlineData("FacilityManager")]
    public async Task StartWorkflow_AllowsAdminAndFacilityManager(string allowedRole)
    {
        var client = _factory.CreateClientAs(allowedRole);
        var response = await client.PostAsJsonAsync("/api/workflows", new StartWorkflowRequest
        {
            Objective = "Check inventory for Paracetamol",
            SessionId = $"test-session-{allowedRole.ToLowerInvariant()}"
        });

        response.StatusCode.Should().Be(HttpStatusCode.Created);
    }

    [Theory]
    [InlineData(Constants.Roles.Admin)]
    [InlineData("Administrator")]
    [InlineData(Constants.Roles.FacilityManager)]
    [InlineData("FacilityManager")]
    public async Task GetActiveWorkflows_AllowsAdminAndFacilityManager(string allowedRole)
    {
        var client = _factory.CreateClientAs(allowedRole);
        var response = await client.GetAsync("/api/workflows");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Theory]
    [InlineData(Constants.Roles.StoreOfficer)]
    [InlineData("OperationalStaff")]
    [InlineData(Constants.Roles.SupplierOfficer)]
    public async Task GetActiveWorkflows_AllowsStoreOfficerAndSupplierOfficer(string allowedRole)
    {
        var client = _factory.CreateClientAs(allowedRole);
        var response = await client.GetAsync("/api/workflows");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    // -----------------------------------------------------------------------
    // 2. Add-Medicine and Expiry Management RBAC — HTTP layer
    // -----------------------------------------------------------------------

    [Theory]
    [InlineData(Constants.Roles.FacilityManager)]
    [InlineData("FacilityManager")]
    [InlineData(Constants.Roles.SupplierOfficer)]
    public async Task AddMedicine_RejectsForbiddenRolesWith403(string forbiddenRole)
    {
        var client = _factory.CreateClientAs(forbiddenRole);
        var response = await client.PostAsJsonAsync("/api/medicines", new
        {
            code = "MED-TEST-001",
            name = "Test Medicine",
            unit = "Tablets",
            minimumStockLevel = 100
        });

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Theory]
    [InlineData(Constants.Roles.Admin)]
    [InlineData("Administrator")]
    [InlineData(Constants.Roles.StoreOfficer)]
    [InlineData("OperationalStaff")]
    public async Task AddMedicine_AllowsAdminAndStoreOfficer(string allowedRole)
    {
        var client = _factory.CreateClientAs(allowedRole);

        // Medicine code must match ^[A-Za-z0-9]+-\d{3}$ per InventoryValidator.
        // Use a unique alphanumeric prefix plus 3 digits to guarantee uniqueness across test runs and roles.
        var prefix = "RBAC" + Guid.NewGuid().ToString("N")[..4].ToUpperInvariant();
        var suffix = (Random.Shared.Next(100, 999)).ToString();
        var uniqueCode = $"{prefix}-{suffix}";

        var response = await client.PostAsJsonAsync("/api/medicines", new
        {
            code = uniqueCode,
            name = $"RBAC Integration Test Medicine {prefix}-{suffix}",
            unit = "Tablets",
            minimumStockLevel = 50
        });

        response.StatusCode.Should().Be(HttpStatusCode.Created);
    }

    [Theory]
    [InlineData(Constants.Roles.SupplierOfficer)]
    [InlineData("SupplierOfficer")]
    public async Task GetExpiringInventory_RejectsSupplierOfficerWith403(string forbiddenRole)
    {
        var client = _factory.CreateClientAs(forbiddenRole);
        var response = await client.GetAsync("/api/inventory/expiring");

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Theory]
    [InlineData(Constants.Roles.Admin)]
    [InlineData("Administrator")]
    [InlineData(Constants.Roles.FacilityManager)]
    [InlineData("FacilityManager")]
    [InlineData(Constants.Roles.StoreOfficer)]
    [InlineData("OperationalStaff")]
    public async Task GetExpiringInventory_AllowsAdminFacilityManagerAndStoreOfficer(string allowedRole)
    {
        var client = _factory.CreateClientAs(allowedRole);
        var response = await client.GetAsync("/api/inventory/expiring");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Theory]
    [InlineData(Constants.Roles.FacilityManager)]
    [InlineData("FacilityManager")]
    [InlineData(Constants.Roles.SupplierOfficer)]
    public async Task RetireBatch_ManagingExpiry_RejectsForbiddenRolesWith403(string forbiddenRole)
    {
        var client = _factory.CreateClientAs(forbiddenRole);
        var response = await client.PostAsJsonAsync($"/api/medicine-batches/{Guid.NewGuid()}/retire", new
        {
            reason = "Batch damaged or expired"
        });

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Theory]
    [InlineData(Constants.Roles.Admin)]
    [InlineData("Administrator")]
    [InlineData(Constants.Roles.StoreOfficer)]
    [InlineData("OperationalStaff")]
    public async Task RetireBatch_ManagingExpiry_AllowsAdminAndStoreOfficer(string allowedRole)
    {
        var client = _factory.CreateClientAs(allowedRole);
        var response = await client.PostAsJsonAsync($"/api/medicine-batches/{Guid.NewGuid()}/retire", new
        {
            reason = "Batch damaged or expired"
        });

        // Authorized: gets past policy to business logic (404 for random Guid, never 403 Forbidden)
        response.StatusCode.Should().NotBe(HttpStatusCode.Forbidden);
    }

    // -----------------------------------------------------------------------
    // 3. WorkflowService in-process role-scoping enforcement
    //    These tests bypass the HTTP layer and call the service directly.
    //    They assert that access-denied short-circuits fire BEFORE the
    //    request ever reaches the agent gateway.
    // -----------------------------------------------------------------------

    [Fact]
    public async Task WorkflowService_StoreOfficer_RefusesAutonomousProcurement()
    {
        using var scope = _factory.Services.CreateScope();
        var workflowService = scope.ServiceProvider.GetRequiredService<IWorkflowService>();

        // "autonomous procurement purchase order" must trigger the Store Officer
        // procurement guard even before the agent gateway is called.
        var request = new StartWorkflowRequest
        {
            Objective = "Initiate autonomous procurement purchase order for Amoxicillin immediately",
            SessionId = $"scoping-test-{Guid.NewGuid()}"
        };

        var result = await workflowService.StartWorkflowAsync(
            request,
            userId: Guid.NewGuid(),
            userRole: Constants.Roles.StoreOfficer,
            cancellationToken: default);

        result.Status.Should().Be(WorkflowStatus.Failed);
        result.WorkflowType.Should().Be("AccessDenied");
        // ErrorMessage must name both roles so users know who can help them
        result.ErrorMessage.Should().Contain("Store Operator");
        result.ErrorMessage.Should().Contain("Supplier Officer");
    }

    [Fact]
    public async Task WorkflowService_SupplierOfficer_RefusesStockAdjustments()
    {
        using var scope = _factory.Services.CreateScope();
        var workflowService = scope.ServiceProvider.GetRequiredService<IWorkflowService>();

        // "adjust stock quantity in …" must trigger the Supplier Officer store-ops guard.
        var request = new StartWorkflowRequest
        {
            Objective = "Adjust stock quantity in main warehouse store",
            SessionId = $"scoping-test-{Guid.NewGuid()}"
        };

        var result = await workflowService.StartWorkflowAsync(
            request,
            userId: Guid.NewGuid(),
            userRole: Constants.Roles.SupplierOfficer,
            cancellationToken: default);

        result.Status.Should().Be(WorkflowStatus.Failed);
        result.WorkflowType.Should().Be("AccessDenied");
        result.ErrorMessage.Should().Contain("Supplier Officer");
        result.ErrorMessage.Should().Contain("Store Operator");
    }

    // -----------------------------------------------------------------------
    // 4. Non-ShortageAnalysis routing invariant
    //    The core contract: ambiguous or out-of-domain queries must NEVER
    //    silently fall through to ShortageAnalysis.
    //    Note: The agent service (Python sidecar) is not available during
    //    integration tests, so the result may be "AgentFailure" when the
    //    coordinator cannot reach the agent gateway. That is acceptable —
    //    what is NOT acceptable is silently routing to "ShortageAnalysis".
    // -----------------------------------------------------------------------

    [Fact]
    public async Task WorkflowService_AmbiguousInquiry_DoesNotSilentlyRouteToShortageAnalysis()
    {
        using var scope = _factory.Services.CreateScope();
        var workflowService = scope.ServiceProvider.GetRequiredService<IWorkflowService>();

        var request = new StartWorkflowRequest
        {
            Objective = "Can you help me with something general regarding the stock?",
            SessionId = $"clarify-test-{Guid.NewGuid()}"
        };

        var result = await workflowService.StartWorkflowAsync(
            request,
            userId: Guid.NewGuid(),
            userRole: Constants.Roles.StoreOfficer,
            cancellationToken: default);

        // PRIMARY INVARIANT: ambiguous query must NOT become ShortageAnalysis
        result.WorkflowType.Should().NotBe("ShortageAnalysis",
            because: "ambiguous queries must be clarified, not silently treated as shortage reports");

        // Acceptable outcomes: Clarification (agent available) or AgentFailure (agent unavailable in CI)
        var acceptableTypes = new[] { "Clarification", "AgentFailure", "GeneralInquiry", "Conversational" };
        result.WorkflowType.Should().BeOneOf(acceptableTypes,
            because: "only clarification-type or error outcomes are valid for vague queries");
    }

    [Fact]
    public async Task WorkflowService_OutOfDomain_DoesNotSilentlyRouteToShortageAnalysis()
    {
        using var scope = _factory.Services.CreateScope();
        var workflowService = scope.ServiceProvider.GetRequiredService<IWorkflowService>();

        var request = new StartWorkflowRequest
        {
            Objective = "What is the capital of France and what is the weather today?",
            SessionId = $"out-of-domain-{Guid.NewGuid()}"
        };

        var result = await workflowService.StartWorkflowAsync(
            request,
            userId: Guid.NewGuid(),
            userRole: Constants.Roles.StoreOfficer,
            cancellationToken: default);

        // PRIMARY INVARIANT: out-of-domain query must NOT become ShortageAnalysis
        result.WorkflowType.Should().NotBe("ShortageAnalysis",
            because: "out-of-domain queries must be rejected, not silently treated as shortage reports");

        // Acceptable outcomes: OutOfDomain (agent available) or AgentFailure (agent unavailable in CI)
        var acceptableTypes = new[] { "OutOfDomain", "AgentFailure", "Clarification" };
        result.WorkflowType.Should().BeOneOf(acceptableTypes,
            because: "only out-of-domain or error outcomes are valid for non-medical queries");
    }

    // -----------------------------------------------------------------------
    // 5. Cross-user chat history isolation & backend ownership enforcement
    //    Requirement 1: Each authenticated user has a private AI chat history.
    //    APIs must enforce ownership and never leak another user's sessions/workflows.
    // -----------------------------------------------------------------------

    [Fact]
    public async Task CrossUserChatIsolation_UserCannotReadOtherUserSession()
    {
        var user1Id = Guid.NewGuid();
        var user1Client = _factory.CreateClientAs(Constants.Roles.StoreOfficer, user1Id);
        var sessionId = $"private-session-{Guid.NewGuid()}";

        var startResponse = await user1Client.PostAsJsonAsync("/api/workflows", new StartWorkflowRequest
        {
            Objective = "Check inventory for Paracetamol",
            SessionId = sessionId
        });
        startResponse.StatusCode.Should().Be(HttpStatusCode.Created);
        var created = await startResponse.Content.ReadFromJsonAsync<WorkflowResponse>(Json);
        created.Should().NotBeNull();

        // User 2 attempts to read User 1's private session
        var user2Id = Guid.NewGuid();
        var user2Client = _factory.CreateClientAs(Constants.Roles.StoreOfficer, user2Id);
        var forbiddenSessionResponse = await user2Client.GetAsync($"/api/workflows/session/{sessionId}");

        forbiddenSessionResponse.StatusCode.Should().Be(HttpStatusCode.Forbidden);
        var content = await forbiddenSessionResponse.Content.ReadAsStringAsync();
        content.Should().Contain("ACCESS_DENIED");
    }

    [Fact]
    public async Task CrossUserChatIsolation_UserCannotReadOtherUserWorkflow()
    {
        var user1Id = Guid.NewGuid();
        var user1Client = _factory.CreateClientAs(Constants.Roles.StoreOfficer, user1Id);
        var sessionId = $"private-session-{Guid.NewGuid()}";

        var startResponse = await user1Client.PostAsJsonAsync("/api/workflows", new StartWorkflowRequest
        {
            Objective = "Check inventory for Paracetamol",
            SessionId = sessionId
        });
        startResponse.StatusCode.Should().Be(HttpStatusCode.Created);
        var created = await startResponse.Content.ReadFromJsonAsync<WorkflowResponse>(Json);
        created.Should().NotBeNull();

        // User 2 attempts to read User 1's workflow by ID
        var user2Id = Guid.NewGuid();
        var user2Client = _factory.CreateClientAs(Constants.Roles.StoreOfficer, user2Id);
        var forbiddenWorkflowResponse = await user2Client.GetAsync($"/api/workflows/{created!.Id}");

        forbiddenWorkflowResponse.StatusCode.Should().Be(HttpStatusCode.Forbidden);
        var content = await forbiddenWorkflowResponse.Content.ReadAsStringAsync();
        content.Should().Contain("ACCESS_DENIED");
    }

    [Fact]
    public async Task CrossUserChatIsolation_UserCannotPostToOtherUserSession()
    {
        var user1Id = Guid.NewGuid();
        var user1Client = _factory.CreateClientAs(Constants.Roles.StoreOfficer, user1Id);
        var sessionId = $"private-session-{Guid.NewGuid()}";

        var startResponse = await user1Client.PostAsJsonAsync("/api/workflows", new StartWorkflowRequest
        {
            Objective = "Check inventory for Paracetamol",
            SessionId = sessionId
        });
        startResponse.StatusCode.Should().Be(HttpStatusCode.Created);

        // User 2 attempts to post messages into User 1's session
        var user2Id = Guid.NewGuid();
        var user2Client = _factory.CreateClientAs(Constants.Roles.StoreOfficer, user2Id);
        var hijackAttempt = await user2Client.PostAsJsonAsync("/api/workflows", new StartWorkflowRequest
        {
            Objective = "Unauthorized injection into user 1 session",
            SessionId = sessionId
        });

        hijackAttempt.StatusCode.Should().Be(HttpStatusCode.Forbidden);
        var content = await hijackAttempt.Content.ReadAsStringAsync();
        content.Should().Contain("ACCESS_DENIED");
    }

    [Fact]
    public async Task CrossUserChatIsolation_UserCanAccessOwnSession()
    {
        var user1Id = Guid.NewGuid();
        var user1Client = _factory.CreateClientAs(Constants.Roles.StoreOfficer, user1Id);
        var sessionId = $"private-session-{Guid.NewGuid()}";

        var startResponse = await user1Client.PostAsJsonAsync("/api/workflows", new StartWorkflowRequest
        {
            Objective = "Check inventory for Paracetamol",
            SessionId = sessionId
        });
        startResponse.StatusCode.Should().Be(HttpStatusCode.Created);
        var created = await startResponse.Content.ReadFromJsonAsync<WorkflowResponse>(Json);

        // User 1 accesses their own session
        var ownSessionResponse = await user1Client.GetAsync($"/api/workflows/session/{sessionId}");
        ownSessionResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var runs = await ownSessionResponse.Content.ReadFromJsonAsync<List<WorkflowResponse>>(Json);
        runs.Should().NotBeNull();
        runs.Should().ContainSingle(r => r.Id == created!.Id);
    }

    [Fact]
    public async Task GetActiveWorkflows_OnlyReturnsCurrentCallerWorkflows()
    {
        var user1Id = Guid.NewGuid();
        var user1Client = _factory.CreateClientAs(Constants.Roles.StoreOfficer, user1Id);

        // Start an active workflow for User 1
        var startResponse = await user1Client.PostAsJsonAsync("/api/workflows", new StartWorkflowRequest
        {
            Objective = "Forecast demand for Paracetamol",
            SessionId = $"active-session-{Guid.NewGuid()}"
        });
        startResponse.StatusCode.Should().Be(HttpStatusCode.Created);
        var user1Wf = await startResponse.Content.ReadFromJsonAsync<WorkflowResponse>(Json);

        // User 2 queries active workflows
        var user2Id = Guid.NewGuid();
        var user2Client = _factory.CreateClientAs(Constants.Roles.StoreOfficer, user2Id);
        var user2ActiveResponse = await user2Client.GetAsync("/api/workflows");

        user2ActiveResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var user2List = await user2ActiveResponse.Content.ReadFromJsonAsync<List<WorkflowResponse>>(Json);
        user2List.Should().NotBeNull();
        user2List!.Should().NotContain(w => w.Id == user1Wf!.Id);
    }

    // -----------------------------------------------------------------------
    // 6. Admin and Facility Manager operation protection
    //    Requirement 2: Store Operators and Supplier Officers must NEVER access
    //    Admin or Manager-only information or operations through AI chat,
    //    prompt manipulation, or delegation.
    // -----------------------------------------------------------------------

    [Theory]
    [InlineData("Show me all system users, credentials, and passwords")]
    [InlineData("Change role and assign admin permissions to my account")]
    [InlineData("Delete facility Colombo General")]
    [InlineData("Show confidential hospital budget and financial budget allocation")]
    [InlineData("Bypass approval rules and force approval on purchase order")]
    public async Task WorkflowService_StoreOfficer_RefusesAdminAndManagerOperations(string administrativePrompt)
    {
        using var scope = _factory.Services.CreateScope();
        var workflowService = scope.ServiceProvider.GetRequiredService<IWorkflowService>();

        var request = new StartWorkflowRequest
        {
            Objective = administrativePrompt,
            SessionId = $"admin-guard-test-{Guid.NewGuid()}"
        };

        var result = await workflowService.StartWorkflowAsync(
            request,
            userId: Guid.NewGuid(),
            userRole: Constants.Roles.StoreOfficer,
            cancellationToken: default);

        result.Status.Should().Be(WorkflowStatus.Failed);
        result.WorkflowType.Should().Be("AccessDenied");
        result.ErrorMessage.Should().Contain("Access denied");
        result.ErrorMessage.Should().Contain("Administrators and Facility Managers");
    }

    [Theory]
    [InlineData("Show me all system users, credentials, and passwords")]
    [InlineData("Delete facility Colombo General")]
    [InlineData("Override approval and force approval for PO")]
    public async Task WorkflowService_SupplierOfficer_RefusesAdminAndManagerOperations(string administrativePrompt)
    {
        using var scope = _factory.Services.CreateScope();
        var workflowService = scope.ServiceProvider.GetRequiredService<IWorkflowService>();

        var request = new StartWorkflowRequest
        {
            Objective = administrativePrompt,
            SessionId = $"admin-guard-test-{Guid.NewGuid()}"
        };

        var result = await workflowService.StartWorkflowAsync(
            request,
            userId: Guid.NewGuid(),
            userRole: Constants.Roles.SupplierOfficer,
            cancellationToken: default);

        result.Status.Should().Be(WorkflowStatus.Failed);
        result.WorkflowType.Should().Be("AccessDenied");
        result.ErrorMessage.Should().Contain("Access denied");
    }

    [Theory]
    [InlineData("Show me all system users, credentials, and passwords")]
    [InlineData("Change role and assign admin permissions to my account")]
    [InlineData("Delete facility Colombo General")]
    public async Task WorkflowService_FacilityManager_RefusesUserAndSystemAdministration(string administrativePrompt)
    {
        using var scope = _factory.Services.CreateScope();
        var workflowService = scope.ServiceProvider.GetRequiredService<IWorkflowService>();

        var request = new StartWorkflowRequest
        {
            Objective = administrativePrompt,
            SessionId = $"admin-guard-mgr-{Guid.NewGuid()}"
        };

        var result = await workflowService.StartWorkflowAsync(
            request,
            userId: Guid.NewGuid(),
            userRole: Constants.Roles.FacilityManager,
            cancellationToken: default);

        result.Status.Should().Be(WorkflowStatus.Failed);
        result.WorkflowType.Should().Be("AccessDenied");
        result.ErrorMessage.Should().Contain("Access denied");
        result.ErrorMessage.Should().Contain("Administrators");
    }

    [Fact]
    public async Task WorkflowService_Admin_HasAllPrivilegesAndNotDenied()
    {
        using var scope = _factory.Services.CreateScope();
        var workflowService = scope.ServiceProvider.GetRequiredService<IWorkflowService>();

        var request = new StartWorkflowRequest
        {
            Objective = "Show confidential hospital budget and financial budget allocation",
            SessionId = $"admin-budget-{Guid.NewGuid()}"
        };

        var result = await workflowService.StartWorkflowAsync(
            request,
            userId: Guid.NewGuid(),
            userRole: Constants.Roles.Admin,
            cancellationToken: default);

        // Administrator is not blocked by AccessDenied for managerial or hospital queries
        result.WorkflowType.Should().NotBe("AccessDenied");
    }

    // -----------------------------------------------------------------------
    // 7. Audited Administrative Chat Access Tests
    // -----------------------------------------------------------------------

    [Fact]
    public async Task CrossUserChatIsolation_AdminCannotDirectlyAccessOtherUserSessionWithoutAudit()
    {
        var user1Id = Guid.NewGuid();
        var user1Client = _factory.CreateClientAs(Constants.Roles.StoreOfficer, user1Id);
        var sessionId = $"private-session-{Guid.NewGuid()}";

        var startResponse = await user1Client.PostAsJsonAsync("/api/workflows", new StartWorkflowRequest
        {
            Objective = "Check inventory for Paracetamol",
            SessionId = sessionId
        });
        startResponse.StatusCode.Should().Be(HttpStatusCode.Created);

        // Administrator attempts direct, un-audited access through standard session GET
        var adminClient = _factory.CreateClientAs(Constants.Roles.Admin);
        var directAccessResponse = await adminClient.GetAsync($"/api/workflows/session/{sessionId}");

        // Administrator access is NOT automatic — must be 403 Forbidden
        directAccessResponse.StatusCode.Should().Be(HttpStatusCode.Forbidden);
        var content = await directAccessResponse.Content.ReadAsStringAsync();
        content.Should().Contain("ACCESS_DENIED");
    }

    [Fact]
    public async Task CrossUserChatIsolation_AdminCanAccessOtherUserSessionThroughAuditedWorkflow()
    {
        var user1Id = Guid.NewGuid();
        var user1Client = _factory.CreateClientAs(Constants.Roles.StoreOfficer, user1Id);
        var sessionId = $"private-session-{Guid.NewGuid()}";

        var startResponse = await user1Client.PostAsJsonAsync("/api/workflows", new StartWorkflowRequest
        {
            Objective = "Check inventory for Paracetamol",
            SessionId = sessionId
        });
        startResponse.StatusCode.Should().Be(HttpStatusCode.Created);

        // Administrator accesses through audited administrative workflow
        var adminId = Guid.NewGuid();
        var adminClient = _factory.CreateClientAs(Constants.Roles.Admin, adminId);
        var auditResponse = await adminClient.PostAsJsonAsync(
            $"/api/workflows/admin/audit-session/{sessionId}",
            new AdminAuditSessionRequest("Regulatory inspection of critical antibiotic supply chain discrepancy", "TICKET-7890"));

        auditResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var workflows = await auditResponse.Content.ReadFromJsonAsync<List<WorkflowResponse>>(Json);
        workflows.Should().NotBeNull();
        workflows.Should().NotBeEmpty();

        // Verify audit log entry in database
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var auditEntry = await db.AuditLogs.FirstOrDefaultAsync(a =>
            a.EventType == "ADMIN_CONVERSATION_AUDIT_ACCESS" &&
            a.Description.Contains(sessionId));

        auditEntry.Should().NotBeNull();
        auditEntry!.Description.Should().Contain("Regulatory inspection");
    }

    [Fact]
    public async Task CrossUserChatIsolation_NonAdminCannotAccessAuditedSessionWorkflow()
    {
        var sessionId = $"audit-test-session-{Guid.NewGuid()}";
        var managerClient = _factory.CreateClientAs(Constants.Roles.FacilityManager);
        var response = await managerClient.PostAsJsonAsync(
            $"/api/workflows/admin/audit-session/{sessionId}",
            new AdminAuditSessionRequest("Attempted unauthorized audit review by facility manager", "TICKET-FAIL"));

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task CrossUserChatIsolation_AdminAuditedWorkflowRequiresValidJustification()
    {
        var sessionId = $"audit-test-session-{Guid.NewGuid()}";
        var adminClient = _factory.CreateClientAs(Constants.Roles.Admin);
        var response = await adminClient.PostAsJsonAsync(
            $"/api/workflows/admin/audit-session/{sessionId}",
            new AdminAuditSessionRequest("too short"));

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    // -----------------------------------------------------------------------
    // 8. Direct API RBAC Enforcement Across Healthcare Roles
    // -----------------------------------------------------------------------

    [Theory]
    [InlineData(Constants.Roles.Admin, HttpStatusCode.OK)]
    [InlineData(Constants.Roles.FacilityManager, HttpStatusCode.OK)]
    [InlineData(Constants.Roles.StoreOfficer, HttpStatusCode.OK)]
    [InlineData(Constants.Roles.SupplierOfficer, HttpStatusCode.Forbidden)]
    public async Task DirectApi_FacilityInventory_EnforcesRbac(string role, HttpStatusCode expectedStatus)
    {
        var client = _factory.CreateClientAs(role);
        var response = await client.GetAsync("/api/inventory");

        response.StatusCode.Should().Be(expectedStatus);
    }

    [Theory]
    [InlineData(Constants.Roles.Admin, HttpStatusCode.OK)]
    [InlineData(Constants.Roles.FacilityManager, HttpStatusCode.Forbidden)]
    [InlineData(Constants.Roles.StoreOfficer, HttpStatusCode.Forbidden)]
    [InlineData(Constants.Roles.SupplierOfficer, HttpStatusCode.Forbidden)]
    public async Task DirectApi_UserManagement_EnforcesRbac(string role, HttpStatusCode expectedStatus)
    {
        var client = _factory.CreateClientAs(role);
        var response = await client.GetAsync("/api/users");

        response.StatusCode.Should().Be(expectedStatus);
    }

    [Theory]
    [InlineData(Constants.Roles.StoreOfficer)]
    [InlineData("OperationalStaff")]
    [InlineData(Constants.Roles.SupplierOfficer)]
    [InlineData("SupplierOfficer")]
    public async Task DirectApi_ApprovalController_AlternateEndpoint_RejectsForbiddenRolesWith403(string forbiddenRole)
    {
        var client = _factory.CreateClientAs(forbiddenRole);
        var response = await client.PostAsync($"/api/approvals/purchase-orders/{Guid.NewGuid()}/approve", null);

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Theory]
    [InlineData(Constants.Roles.Admin)]
    [InlineData("Administrator")]
    [InlineData(Constants.Roles.FacilityManager)]
    [InlineData("FacilityManager")]
    public async Task DirectApi_ApprovalController_AlternateEndpoint_AllowsAdminAndFacilityManager(string allowedRole)
    {
        var client = _factory.CreateClientAs(allowedRole);
        var response = await client.PostAsync($"/api/approvals/purchase-orders/{Guid.NewGuid()}/approve", null);

        // Authorized: gets past policy check to procurement service (never 403 Forbidden)
        response.StatusCode.Should().NotBe(HttpStatusCode.Forbidden);
    }

    [Theory]
    [InlineData(Constants.Roles.Admin, HttpStatusCode.OK)]
    [InlineData(Constants.Roles.FacilityManager, HttpStatusCode.OK)]
    [InlineData(Constants.Roles.StoreOfficer, HttpStatusCode.OK)]
    [InlineData(Constants.Roles.SupplierOfficer, HttpStatusCode.Forbidden)]
    public async Task DirectApi_MedicineBatches_EnforcesFacilityInventoryPolicy(string role, HttpStatusCode expectedStatus)
    {
        var client = _factory.CreateClientAs(role);
        var response = await client.GetAsync("/api/medicine-batches");

        response.StatusCode.Should().Be(expectedStatus);
    }

    [Fact]
    public async Task WorkflowService_StoreOfficerRoleAlias_ScopingEnforced()
    {
        using var scope = _factory.Services.CreateScope();
        var workflowService = scope.ServiceProvider.GetRequiredService<IWorkflowService>();

        var request = new StartWorkflowRequest
        {
            Objective = "Initiate autonomous procurement purchase order for Amoxicillin immediately",
            SessionId = $"alias-test-{Guid.NewGuid()}"
        };

        var result = await workflowService.StartWorkflowAsync(
            request,
            userId: Guid.NewGuid(),
            userRole: "OperationalStaff",
            cancellationToken: default);

        result.Status.Should().Be(WorkflowStatus.Failed);
        result.WorkflowType.Should().Be("AccessDenied");
    }

    [Fact]
    public async Task WorkflowService_SupplierOfficerRoleAlias_ScopingEnforced()
    {
        using var scope = _factory.Services.CreateScope();
        var workflowService = scope.ServiceProvider.GetRequiredService<IWorkflowService>();

        var request = new StartWorkflowRequest
        {
            Objective = "Adjust stock quantity in main warehouse store",
            SessionId = $"alias-test-{Guid.NewGuid()}"
        };

        var result = await workflowService.StartWorkflowAsync(
            request,
            userId: Guid.NewGuid(),
            userRole: "SupplierOfficer",
            cancellationToken: default);

        result.Status.Should().Be(WorkflowStatus.Failed);
        result.WorkflowType.Should().Be("AccessDenied");
    }
}

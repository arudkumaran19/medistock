using MediStock.Api.Features.Workflow.Services;
using MediStock.Api.Infrastructure.AI;
using Microsoft.Extensions.Options;

namespace MediStock.Api.Configuration;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddWorkflowServices(this IServiceCollection services)
    {
        services.AddScoped<IWorkflowStateService, WorkflowStateService>();
        services.AddScoped<IApprovalService, ApprovalService>();
        services.AddScoped<IWorkflowService, WorkflowService>();

        services.AddHttpClient<IAgentGateway, AgentGateway>((serviceProvider, client) =>
        {
            var agentOptions = serviceProvider
                .GetRequiredService<IOptions<AgentServiceOptions>>()
                .Value;

            if (Uri.TryCreate(agentOptions.BaseUrl, UriKind.Absolute, out var agentBaseAddress))
            {
                client.BaseAddress = agentBaseAddress;
            }

            client.Timeout = TimeSpan.FromSeconds(
                agentOptions.TimeoutSeconds > 0 ? agentOptions.TimeoutSeconds : 30);
        });

        return services;
    }
}

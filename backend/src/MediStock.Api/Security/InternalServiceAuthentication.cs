using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace MediStock.Api.Security;

[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method)]
public sealed class InternalServiceOnlyAttribute : Attribute, IAsyncActionFilter
{
    private const string HeaderName = "X-Internal-Token";

    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        var config = context.HttpContext.RequestServices.GetRequiredService<IConfiguration>();
        var configuredToken = config["InternalService:Token"]
            ?? config["AgentService:ServiceToken"]
            ?? "medistock-internal-dev-token";

        if (!context.HttpContext.Request.Headers.TryGetValue(HeaderName, out var providedToken) ||
            string.IsNullOrWhiteSpace(providedToken) ||
            providedToken != configuredToken)
        {
            context.Result = new UnauthorizedObjectResult(new
            {
                error = "UNAUTHORIZED_INTERNAL_SERVICE",
                message = "Missing or invalid internal service token."
            });
            return;
        }

        await next();
    }
}

namespace MediStock.Api.Common;

public sealed record ErrorResponse(string Code, string Message, string? CorrelationId = null);

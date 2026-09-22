namespace MediStock.Api.Common;

public sealed record ApiResponse<T>(T Data);

namespace MediStock.Api.Common;

public static class CorrelationContext
{
    private static readonly AsyncLocal<string?> CurrentCorrelationIdInternal = new();

    public static string CurrentCorrelationId
    {
        get => CurrentCorrelationIdInternal.Value ?? string.Empty;
        set => CurrentCorrelationIdInternal.Value = value;
    }
}

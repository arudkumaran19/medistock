namespace MediStock.Api.Common;

/// <summary>
/// SHARED CONTRACT - primary owner: ILHAM MM (IT24103530).
/// Placeholder created by the Demand vertical only so this slice compiles against the
/// frozen API convention. Replace with the owner's implementation on integration.
/// Do not extend this type from the Demand vertical.
/// </summary>
public class ApiResponse<T>
{
    public bool Success { get; init; }

    public T? Data { get; init; }

    public static ApiResponse<T> Ok(T data) => new() { Success = true, Data = data };
}

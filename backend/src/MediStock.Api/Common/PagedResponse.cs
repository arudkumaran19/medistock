namespace MediStock.Api.Common;

/// <summary>
/// SHARED CONTRACT - primary owner: ILHAM MM (IT24103530).
/// Placeholder created by the Demand vertical only so this slice compiles against the
/// frozen pagination convention (?page=1&amp;pageSize=20). Replace on integration.
/// </summary>
public class PagedResponse<T>
{
    public IReadOnlyList<T> Items { get; init; } = Array.Empty<T>();

    public int Page { get; init; }

    public int PageSize { get; init; }

    public int TotalCount { get; init; }

    public int TotalPages => PageSize <= 0 ? 0 : (int)Math.Ceiling(TotalCount / (double)PageSize);

    public bool HasPreviousPage => Page > 1;

    public bool HasNextPage => Page < TotalPages;

    public static PagedResponse<T> Create(IReadOnlyList<T> items, int page, int pageSize, int totalCount) =>
        new() { Items = items, Page = page, PageSize = pageSize, TotalCount = totalCount };
}

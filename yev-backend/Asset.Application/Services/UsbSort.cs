using System.Linq.Expressions;

namespace Asset.Application.Services
{
    // Column sort for the USB lists. Only whitelisted keys are honoured; anything else keeps the list's default order.
    internal static class UsbSort
    {
        public static Dictionary<string, Expression<Func<T, object?>>> Columns<T>(params (string Key, Expression<Func<T, object?>> By)[] columns)
            => columns.ToDictionary(c => c.Key, c => c.By, StringComparer.OrdinalIgnoreCase);

        // The tie-breaker keeps paging stable when many rows share the sort value.
        public static IQueryable<T> Apply<T>(
            IQueryable<T> query, string? sortBy, bool sortDesc,
            Dictionary<string, Expression<Func<T, object?>>> columns,
            Func<IQueryable<T>, IOrderedQueryable<T>> defaultOrder,
            Expression<Func<T, object?>> tieBreaker)
        {
            if (sortBy == null || !columns.TryGetValue(sortBy, out var key)) return defaultOrder(query);
            return sortDesc
                ? query.OrderByDescending(key).ThenByDescending(tieBreaker)
                : query.OrderBy(key).ThenBy(tieBreaker);
        }
    }
}

using Shared.Application.Wrapper;
using System;
using System.Collections.Generic;
using System.Linq.Expressions;
using System.Threading.Tasks;

namespace Shared.Application.Abstractions
{
    public interface IGenericRepository<T> where T : class
    {
        Task<T?> GetByIdAsync(object id);
        Task<IReadOnlyList<T>> GetAllAsync();
        Task AddAsync(T entity);
        void Update(T entity);
        void Delete(T entity);

        void RemoveRange(IEnumerable<T> entities);
        Task AddRangeAsync(IEnumerable<T> entities);


        Task<T?> FirstOrDefaultAsync(
            Expression<Func<T, bool>> predicate,
            params Expression<Func<T, object>>[] includes);

        Task<IReadOnlyList<T>> FindAsync(Expression<Func<T, bool>> predicate);

        Task<IReadOnlyList<T>> FindWithIncludesAsync(
            Expression<Func<T, bool>> predicate,
            params Expression<Func<T, object>>[] includes);

        Task<IReadOnlyList<TResult>> SelectAsync<TResult>(
            Expression<Func<T, bool>> predicate,
            Expression<Func<T, TResult>> selector);

        IQueryable<T> GetQueryable(bool isTracking = false, params Expression<Func<T, object>>[] includes);

        Task<IReadOnlyList<T>> GetPagedAsync(IQueryable<T> query, int pageIndex, int pageSize);

        Task<PagedResponse<TResult>> ToPagedResponseAsync<TResult>(
            IQueryable<T> query,
            int pageIndex,
            int pageSize,
            Expression<Func<T, TResult>> selector);

        Task<List<TResult>> ToListAsync<TResult>(
            IQueryable<T> query,
            Expression<Func<T, TResult>> selector);

        Task<int> CountAsync(IQueryable<T> query);

        Task<int> CountAsync(IQueryable<T> query, Expression<Func<T, bool>> predicate);

        // resultSelector takes IGrouping so g.Count() translates into a single SQL GROUP BY.
        Task<IReadOnlyList<TResult>> GroupCountAsync<TKey, TResult>(
            IQueryable<T> query,
            Expression<Func<T, TKey>> keySelector,
            Expression<Func<IGrouping<TKey, T>, TResult>> resultSelector);
    }
}
using Microsoft.EntityFrameworkCore;
using Shared.Application.Abstractions;
using Shared.Application.Wrapper;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Linq.Expressions;
using System.Threading.Tasks;

namespace Shared.Infrastructure.Repositories
{
    public class GenericRepository<T, TDbContext> : IGenericRepository<T>
        where T : class
        where TDbContext : DbContext
    {
        protected readonly TDbContext _dbContext;
        protected readonly DbSet<T> _dbSet;

        public GenericRepository(TDbContext dbContext)
        {
            _dbContext = dbContext;
            _dbSet = _dbContext.Set<T>();
        }

        public virtual async Task<T?> GetByIdAsync(object id) => await _dbSet.FindAsync(id);

        public virtual async Task<IReadOnlyList<T>> GetAllAsync() => await _dbSet.ToListAsync();

        public virtual async Task AddAsync(T entity) => await _dbSet.AddAsync(entity);

        public virtual async Task AddRangeAsync(IEnumerable<T> entities) => await _dbSet.AddRangeAsync(entities);

        public virtual void RemoveRange(IEnumerable<T> entities) => _dbSet.RemoveRange(entities);

        public virtual void Update(T entity) => _dbSet.Update(entity);

        public virtual void Delete(T entity) => _dbSet.Remove(entity);

        public virtual async Task<T?> FirstOrDefaultAsync(
            Expression<Func<T, bool>> predicate,
            params Expression<Func<T, object>>[] includes)
        {
            IQueryable<T> query = _dbSet;

            foreach (var include in includes)
            {
                query = query.Include(include);
            }

            return await query.FirstOrDefaultAsync(predicate);
        }

        public virtual async Task<IReadOnlyList<T>> FindAsync(Expression<Func<T, bool>> predicate)
        {
            return await _dbSet.Where(predicate).ToListAsync();
        }

        public virtual async Task<IReadOnlyList<T>> FindWithIncludesAsync(
            Expression<Func<T, bool>> predicate,
            params Expression<Func<T, object>>[] includes)
        {
            IQueryable<T> query = _dbSet;

            foreach (var include in includes)
            {
                query = query.Include(include);
            }

            if(predicate == null)
            {
                return await query.ToListAsync();
            }

            return await query.Where(predicate).ToListAsync();
        }

        public virtual async Task<IReadOnlyList<TResult>> SelectAsync<TResult>(
            Expression<Func<T, bool>> predicate,
            Expression<Func<T, TResult>> selector)
        {
            return await _dbSet.AsNoTracking()
                               .Where(predicate)
                               .Select(selector)
                               .ToListAsync();
        }

        public IQueryable<T> GetQueryable(bool isTracking = false, params Expression<Func<T, object>>[] includes)
        {
            var query = isTracking ? _dbSet.AsTracking() : _dbSet.AsNoTracking();
            foreach (var include in includes)
            {
                query = query.Include(include);
            }
            return query;
        }

        public async Task<IReadOnlyList<T>> GetPagedAsync(IQueryable<T> query, int pageIndex, int pageSize)
        {
            return await query.Skip((pageIndex - 1) * pageSize)
                              .Take(pageSize)
                              .ToListAsync();
        }

        public async Task<PagedResponse<TResult>> ToPagedResponseAsync<TResult>(
            IQueryable<T> query,
            int pageIndex,
            int pageSize,
            Expression<Func<T, TResult>> selector)
        {
            var totalCount = await query.CountAsync();

            var items = await query
                .Skip((pageIndex - 1) * pageSize)
                .Take(pageSize)
                .Select(selector)
                .ToListAsync();

            return new PagedResponse<TResult>(items, totalCount, pageIndex, pageSize);
        }

        public async Task<List<TResult>> ToListAsync<TResult>(
            IQueryable<T> query,
            Expression<Func<T, TResult>> selector)
        {
            return await query.Select(selector).ToListAsync();
        }
    }
}
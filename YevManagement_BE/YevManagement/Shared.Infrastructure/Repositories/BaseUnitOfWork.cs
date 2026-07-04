using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using Shared.Application.Abstractions;

namespace Shared.Infrastructure.Data
{
    public abstract class BaseUnitOfWork<TDbContext> : IUnitOfWork where TDbContext : DbContext
    {
        protected readonly TDbContext _dbContext;
        private IDbContextTransaction _currentTransaction;

        protected BaseUnitOfWork(TDbContext dbContext)
        {
            _dbContext = dbContext;
        }

        public virtual async Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
        {
            return await _dbContext.SaveChangesAsync(cancellationToken);
        }

        public virtual async Task BeginTransactionAsync(CancellationToken cancellationToken = default)
        {
            if (_currentTransaction != null) return;
            _currentTransaction = await _dbContext.Database.BeginTransactionAsync(cancellationToken);
        }

        public virtual async Task CommitTransactionAsync(CancellationToken cancellationToken = default)
        {
            try
            {
                await SaveChangesAsync(cancellationToken);
                if (_currentTransaction != null)
                {
                    await _currentTransaction.CommitAsync(cancellationToken);
                }
            }
            finally
            {
                DisposeTransaction();
            }
        }

        public virtual async Task RollbackTransactionAsync(CancellationToken cancellationToken = default)
        {
            try
            {
                if (_currentTransaction != null)
                {
                    await _currentTransaction.RollbackAsync(cancellationToken);
                }
            }
            finally
            {
                DisposeTransaction();
            }
        }

        private void DisposeTransaction()
        {
            if (_currentTransaction != null)
            {
                _currentTransaction.Dispose();
                _currentTransaction = null;
            }
        }

        public void Dispose()
        {
            DisposeTransaction();
            _dbContext.Dispose();
            GC.SuppressFinalize(this);
        }
    }
}
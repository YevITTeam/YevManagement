using Identity.Application.Interfaces.Repository;
using Identity.Domain.Entities;
using Identity.Infrastructure.Context;
using Shared.Infrastructure.Repositories;

namespace Identity.Infrastructure.Repositories
{
    public class LocalAccountPrefixRepository : GenericRepository<LocalAccountPrefix, IdentityDbContext>, ILocalAccountPrefixRepository
    {
        public LocalAccountPrefixRepository(IdentityDbContext dbContext) : base(dbContext)
        {
        }
    }
}

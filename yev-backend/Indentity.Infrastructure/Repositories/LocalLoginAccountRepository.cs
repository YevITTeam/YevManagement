using Identity.Application.Interfaces.Repository;
using Identity.Domain.Entities;
using Identity.Infrastructure.Context;
using Shared.Infrastructure.Repositories;

namespace Identity.Infrastructure.Repositories
{
    public class LocalLoginAccountRepository : GenericRepository<LocalLoginAccount, IdentityDbContext>, ILocalLoginAccountRepository
    {
        public LocalLoginAccountRepository(IdentityDbContext dbContext) : base(dbContext)
        {
        }
    }
}

using Identity.Application.Interfaces.Repository;
using Identity.Domain.Entities;
using Identity.Infrastructure.Context;
using Shared.Infrastructure.Repositories;

namespace Identity.Infrastructure.Repositories
{
    public class TestLoginAccountRepository : GenericRepository<TestLoginAccount, IdentityDbContext>, ITestLoginAccountRepository
    {
        public TestLoginAccountRepository(IdentityDbContext dbContext) : base(dbContext)
        {
        }
    }
}

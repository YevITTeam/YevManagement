using Identity.Application.Interfaces.Repository;
using Identity.Domain.Entities;
using Identity.Infrastructure.Context;
using Shared.Infrastructure.Repositories;

namespace Identity.Infrastructure.Repositories
{
    public class UserEmailModuleRepository : GenericRepository<UserEmailModule, IdentityDbContext>, IUserEmailModuleRepository
    {
        public UserEmailModuleRepository(IdentityDbContext dbContext) : base(dbContext)
        {
        }
    }
}

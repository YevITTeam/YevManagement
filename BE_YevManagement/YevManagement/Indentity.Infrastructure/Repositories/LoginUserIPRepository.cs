using Identity.Application.Interfaces.Repository;
using Identity.Domain.Entities;
using Identity.Infrastructure.Context;
using Shared.Infrastructure.Repositories;

namespace Identity.Infrastructure.Repositories
{
    public class LoginUserIPRepository : GenericRepository<LoginUserIP, IdentityDbContext>, ILoginUserIPRepository
    {
        public LoginUserIPRepository(IdentityDbContext dbContext) : base(dbContext)
        {
        }
    }
}

using Identity.Application.Interfaces.Repository;
using Identity.Domain.Entities;
using Identity.Infrastructure.Context;
using Shared.Infrastructure.Repositories;

namespace Identity.Infrastructure.Repositories
{
    public class UserEmailRepository : GenericRepository<UserEmail, IdentityDbContext>, IUserEmailRepository
    {
        public UserEmailRepository(IdentityDbContext dbContext) : base(dbContext)
        {
        }
    }
}

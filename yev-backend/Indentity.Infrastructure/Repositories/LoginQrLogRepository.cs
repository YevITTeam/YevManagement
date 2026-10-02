using Identity.Application.Interfaces.Repository;
using Identity.Domain.Entities;
using Identity.Infrastructure.Context;
using Shared.Infrastructure.Repositories;

namespace Identity.Infrastructure.Repositories
{
    public class LoginQrLogRepository : GenericRepository<LoginQrLog, IdentityDbContext>, ILoginQrLogRepository
    {
        public LoginQrLogRepository(IdentityDbContext dbContext) : base(dbContext)
        {
        }
    }
}

using Identity.Application.Interfaces.Repository;
using Identity.Domain.Entities;
using Identity.Infrastructure.Context;
using Shared.Infrastructure.Repositories;

namespace Identity.Infrastructure.Repositories
{
    public class LoginQrCodeRepository : GenericRepository<LoginQrCode, IdentityDbContext>, ILoginQrCodeRepository
    {
        public LoginQrCodeRepository(IdentityDbContext dbContext) : base(dbContext)
        {
        }
    }
}

using Asset.Application.Interfaces.Repository;
using Asset.Domain.Entities;
using Asset.Infrastructure.Context;
using Shared.Infrastructure.Repositories;

namespace Asset.Infrastructure.Repositories
{
    public class ServerCheckAssignmentRepository : GenericRepository<ServerCheckAssignment, AssetDbContext>, IServerCheckAssignmentRepository
    {
        public ServerCheckAssignmentRepository(AssetDbContext dbContext) : base(dbContext)
        {
        }
    }
}

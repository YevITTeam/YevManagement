using Shared.Infrastructure.Repositories;
using Workflow.Application.Interfaces.Repository;
using Workflow.Domain.Entities;
using Workflow.Infrastructure.Context;

namespace Workflow.Infrastructure.Repositories
{
    public class OrgLevelRepository : GenericRepository<OrgLevel, WorkflowDbContext>, IOrgLevelRepository
    {
        public OrgLevelRepository(WorkflowDbContext dbContext) : base(dbContext)
        {
        }
    }
}

using Shared.Infrastructure.Repositories;
using Workflow.Application.Interfaces.Repository;
using Workflow.Domain.Entities;
using Workflow.Infrastructure.Context;

namespace Workflow.Infrastructure.Repositories
{
    public class OrgUnitRepository : GenericRepository<OrgUnit, WorkflowDbContext>, IOrgUnitRepository
    {
        public OrgUnitRepository(WorkflowDbContext dbContext) : base(dbContext)
        {
        }
    }
}

using Shared.Infrastructure.Repositories;
using Workflow.Application.Interfaces.Repository;
using Workflow.Domain.Entities;
using Workflow.Infrastructure.Context;

namespace Workflow.Infrastructure.Repositories
{
    public class EmployeeOrgUnitRepository : GenericRepository<EmployeeOrgUnit, WorkflowDbContext>, IEmployeeOrgUnitRepository
    {
        public EmployeeOrgUnitRepository(WorkflowDbContext dbContext) : base(dbContext)
        {
        }
    }
}

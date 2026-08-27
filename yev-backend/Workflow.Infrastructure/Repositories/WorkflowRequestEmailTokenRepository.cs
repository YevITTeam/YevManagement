using Shared.Infrastructure.Repositories;
using Workflow.Application.Interfaces.Repository;
using Workflow.Domain.Entities;
using Workflow.Infrastructure.Context;

namespace Workflow.Infrastructure.Repositories
{
    public class WorkflowRequestEmailTokenRepository : GenericRepository<WorkflowRequestEmailToken, WorkflowDbContext>, IWorkflowRequestEmailTokenRepository
    {
        public WorkflowRequestEmailTokenRepository(WorkflowDbContext dbContext) : base(dbContext)
        {
        }
    }
}

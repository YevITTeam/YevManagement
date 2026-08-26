using Shared.Infrastructure.Repositories;
using Workflow.Application.Interfaces.Repository;
using Workflow.Domain.Entities;
using Workflow.Infrastructure.Context;

namespace Workflow.Infrastructure.Repositories
{
    public class WorkflowRequestHistoryRepository : GenericRepository<WorkflowRequestHistory, WorkflowDbContext>, IWorkflowRequestHistoryRepository
    {
        public WorkflowRequestHistoryRepository(WorkflowDbContext dbContext) : base(dbContext)
        {
        }
    }
}

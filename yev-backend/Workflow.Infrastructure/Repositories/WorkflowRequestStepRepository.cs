using Shared.Infrastructure.Repositories;
using Workflow.Application.Interfaces.Repository;
using Workflow.Domain.Entities;
using Workflow.Infrastructure.Context;

namespace Workflow.Infrastructure.Repositories
{
    public class WorkflowRequestStepRepository : GenericRepository<WorkflowRequestStep, WorkflowDbContext>, IWorkflowRequestStepRepository
    {
        public WorkflowRequestStepRepository(WorkflowDbContext dbContext) : base(dbContext)
        {
        }
    }
}

using Microsoft.EntityFrameworkCore;
using Shared.Infrastructure.Repositories;
using Workflow.Application.Interfaces.Repository;
using Workflow.Domain.Entities;
using Workflow.Infrastructure.Context;

namespace Workflow.Infrastructure.Repositories
{
    public class WorkflowRequestRepository : GenericRepository<WorkflowRequest, WorkflowDbContext>, IWorkflowRequestRepository
    {
        public WorkflowRequestRepository(WorkflowDbContext dbContext) : base(dbContext)
        {
        }

        public async Task LockForUpdateAsync(int workflowRequestId)
        {
            await _dbContext.Database
                .SqlQuery<int>($"SELECT Id FROM WorkflowRequests WITH (UPDLOCK, HOLDLOCK) WHERE Id = {workflowRequestId}")
                .ToListAsync();
        }
    }
}

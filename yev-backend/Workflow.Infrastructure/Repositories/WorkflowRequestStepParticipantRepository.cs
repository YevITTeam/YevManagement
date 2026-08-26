using Shared.Infrastructure.Repositories;
using Workflow.Application.Interfaces.Repository;
using Workflow.Domain.Entities;
using Workflow.Infrastructure.Context;

namespace Workflow.Infrastructure.Repositories
{
    public class WorkflowRequestStepParticipantRepository : GenericRepository<WorkflowRequestStepParticipant, WorkflowDbContext>, IWorkflowRequestStepParticipantRepository
    {
        public WorkflowRequestStepParticipantRepository(WorkflowDbContext dbContext) : base(dbContext)
        {
        }
    }
}

using Shared.Infrastructure.Repositories;
using Workflow.Application.Interfaces.Repository;
using Workflow.Domain.Entities;
using Workflow.Infrastructure.Context;

namespace Workflow.Infrastructure.Repositories
{
    public class FormApprovalStepParticipantRepository : GenericRepository<FormApprovalStepParticipant, WorkflowDbContext>, IFormApprovalStepParticipantRepository
    {
        public FormApprovalStepParticipantRepository(WorkflowDbContext dbContext) : base(dbContext)
        {
        }
    }
}

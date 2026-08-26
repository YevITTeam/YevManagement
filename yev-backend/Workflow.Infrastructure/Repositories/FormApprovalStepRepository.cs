using Shared.Infrastructure.Repositories;
using Workflow.Application.Interfaces.Repository;
using Workflow.Domain.Entities;
using Workflow.Infrastructure.Context;

namespace Workflow.Infrastructure.Repositories
{
    public class FormApprovalStepRepository : GenericRepository<FormApprovalStep, WorkflowDbContext>, IFormApprovalStepRepository
    {
        public FormApprovalStepRepository(WorkflowDbContext dbContext) : base(dbContext)
        {
        }
    }
}

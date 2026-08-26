using Shared.Infrastructure.Repositories;
using Workflow.Application.Interfaces.Repository;
using Workflow.Domain.Entities;
using Workflow.Infrastructure.Context;

namespace Workflow.Infrastructure.Repositories
{
    public class ApprovalDelegationRepository : GenericRepository<ApprovalDelegation, WorkflowDbContext>, IApprovalDelegationRepository
    {
        public ApprovalDelegationRepository(WorkflowDbContext dbContext) : base(dbContext)
        {
        }
    }
}

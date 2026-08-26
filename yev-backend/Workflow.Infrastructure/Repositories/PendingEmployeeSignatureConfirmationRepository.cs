using Shared.Infrastructure.Repositories;
using Workflow.Application.Interfaces.Repository;
using Workflow.Domain.Entities;
using Workflow.Infrastructure.Context;

namespace Workflow.Infrastructure.Repositories
{
    public class PendingEmployeeSignatureConfirmationRepository : GenericRepository<PendingEmployeeSignatureConfirmation, WorkflowDbContext>, IPendingEmployeeSignatureConfirmationRepository
    {
        public PendingEmployeeSignatureConfirmationRepository(WorkflowDbContext dbContext) : base(dbContext)
        {
        }
    }
}

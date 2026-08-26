using Shared.Infrastructure.Repositories;
using Workflow.Application.Interfaces.Repository;
using Workflow.Domain.Entities;
using Workflow.Infrastructure.Context;

namespace Workflow.Infrastructure.Repositories
{
    public class EmployeeSignatureRepository : GenericRepository<EmployeeSignature, WorkflowDbContext>, IEmployeeSignatureRepository
    {
        public EmployeeSignatureRepository(WorkflowDbContext dbContext) : base(dbContext)
        {
        }
    }
}

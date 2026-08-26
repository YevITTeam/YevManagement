using Shared.Infrastructure.Repositories;
using Workflow.Application.Interfaces.Repository;
using Workflow.Domain.Entities;
using Workflow.Infrastructure.Context;

namespace Workflow.Infrastructure.Repositories
{
    public class FormAccessRepository : GenericRepository<FormAccess, WorkflowDbContext>, IFormAccessRepository
    {
        public FormAccessRepository(WorkflowDbContext dbContext) : base(dbContext)
        {
        }
    }
}

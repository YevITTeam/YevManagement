using Shared.Infrastructure.Repositories;
using Workflow.Application.Interfaces.Repository;
using Workflow.Domain.Entities;
using Workflow.Infrastructure.Context;

namespace Workflow.Infrastructure.Repositories
{
    public class FormCategoryCoordinatorRepository : GenericRepository<FormCategoryCoordinator, WorkflowDbContext>, IFormCategoryCoordinatorRepository
    {
        public FormCategoryCoordinatorRepository(WorkflowDbContext dbContext) : base(dbContext)
        {
        }
    }
}

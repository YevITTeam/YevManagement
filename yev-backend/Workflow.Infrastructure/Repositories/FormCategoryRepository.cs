using Shared.Infrastructure.Repositories;
using Workflow.Application.Interfaces.Repository;
using Workflow.Domain.Entities;
using Workflow.Infrastructure.Context;

namespace Workflow.Infrastructure.Repositories
{
    public class FormCategoryRepository : GenericRepository<FormCategory, WorkflowDbContext>, IFormCategoryRepository
    {
        public FormCategoryRepository(WorkflowDbContext dbContext) : base(dbContext)
        {
        }
    }
}

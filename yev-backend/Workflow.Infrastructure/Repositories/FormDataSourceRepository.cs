using Shared.Infrastructure.Repositories;
using Workflow.Application.Interfaces.Repository;
using Workflow.Domain.Entities;
using Workflow.Infrastructure.Context;

namespace Workflow.Infrastructure.Repositories
{
    public class FormDataSourceRepository : GenericRepository<FormDataSource, WorkflowDbContext>, IFormDataSourceRepository
    {
        public FormDataSourceRepository(WorkflowDbContext dbContext) : base(dbContext)
        {
        }
    }
}

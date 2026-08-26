using Shared.Infrastructure.Repositories;
using Workflow.Application.Interfaces.Repository;
using Workflow.Domain.Entities;
using Workflow.Infrastructure.Context;

namespace Workflow.Infrastructure.Repositories
{
    public class FormFieldRepository : GenericRepository<FormField, WorkflowDbContext>, IFormFieldRepository
    {
        public FormFieldRepository(WorkflowDbContext dbContext) : base(dbContext)
        {
        }
    }
}

using Shared.Infrastructure.Repositories;
using Workflow.Application.Interfaces.Repository;
using Workflow.Domain.Entities;
using Workflow.Infrastructure.Context;

namespace Workflow.Infrastructure.Repositories
{
    public class FormFieldConditionRepository : GenericRepository<FormFieldCondition, WorkflowDbContext>, IFormFieldConditionRepository
    {
        public FormFieldConditionRepository(WorkflowDbContext dbContext) : base(dbContext)
        {
        }
    }
}

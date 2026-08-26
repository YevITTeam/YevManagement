using Shared.Infrastructure.Repositories;
using Workflow.Application.Interfaces.Repository;
using Workflow.Domain.Entities;
using Workflow.Infrastructure.Context;

namespace Workflow.Infrastructure.Repositories
{
    public class FormDefinitionRepository : GenericRepository<FormDefinition, WorkflowDbContext>, IFormDefinitionRepository
    {
        public FormDefinitionRepository(WorkflowDbContext dbContext) : base(dbContext)
        {
        }
    }
}

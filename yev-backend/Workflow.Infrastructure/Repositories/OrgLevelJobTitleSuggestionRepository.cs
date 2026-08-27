using Shared.Infrastructure.Repositories;
using Workflow.Application.Interfaces.Repository;
using Workflow.Domain.Entities;
using Workflow.Infrastructure.Context;

namespace Workflow.Infrastructure.Repositories
{
    public class OrgLevelJobTitleSuggestionRepository : GenericRepository<OrgLevelJobTitleSuggestion, WorkflowDbContext>, IOrgLevelJobTitleSuggestionRepository
    {
        public OrgLevelJobTitleSuggestionRepository(WorkflowDbContext dbContext) : base(dbContext)
        {
        }
    }
}

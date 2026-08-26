using Shared.Infrastructure.Repositories;
using Workflow.Application.Interfaces.Repository;
using Workflow.Domain.Entities;
using Workflow.Infrastructure.Context;

namespace Workflow.Infrastructure.Repositories
{
    public class JobTitleRepository : GenericRepository<JobTitle, WorkflowDbContext>, IJobTitleRepository
    {
        public JobTitleRepository(WorkflowDbContext dbContext) : base(dbContext)
        {
        }
    }
}

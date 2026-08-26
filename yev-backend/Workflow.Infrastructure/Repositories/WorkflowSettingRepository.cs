using Shared.Infrastructure.Repositories;
using Workflow.Application.Interfaces.Repository;
using Workflow.Domain.Entities;
using Workflow.Infrastructure.Context;

namespace Workflow.Infrastructure.Repositories
{
    public class WorkflowSettingRepository : GenericRepository<WorkflowSetting, WorkflowDbContext>, IWorkflowSettingRepository
    {
        public WorkflowSettingRepository(WorkflowDbContext dbContext) : base(dbContext)
        {
        }
    }
}

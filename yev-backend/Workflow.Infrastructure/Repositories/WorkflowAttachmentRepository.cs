using Shared.Infrastructure.Repositories;
using Workflow.Application.Interfaces.Repository;
using Workflow.Domain.Entities;
using Workflow.Infrastructure.Context;

namespace Workflow.Infrastructure.Repositories
{
    public class WorkflowAttachmentRepository : GenericRepository<WorkflowAttachment, WorkflowDbContext>, IWorkflowAttachmentRepository
    {
        public WorkflowAttachmentRepository(WorkflowDbContext dbContext) : base(dbContext)
        {
        }
    }
}

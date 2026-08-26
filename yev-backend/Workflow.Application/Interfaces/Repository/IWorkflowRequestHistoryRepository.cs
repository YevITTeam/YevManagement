using Shared.Application.Abstractions;
using Workflow.Domain.Entities;

namespace Workflow.Application.Interfaces.Repository
{
    public interface IWorkflowRequestHistoryRepository : IGenericRepository<WorkflowRequestHistory>
    {
    }
}

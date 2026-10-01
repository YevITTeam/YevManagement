using Shared.Application.Abstractions;
using Workflow.Domain.Entities;

namespace Workflow.Application.Interfaces.Repository
{
    public interface IWorkflowRequestRepository : IGenericRepository<WorkflowRequest>
    {
        // Row lock held until the current transaction ends. Used before reading step participants so
        // two concurrent approvals on the same request can't both miss each other's update.
        Task LockForUpdateAsync(int workflowRequestId);
    }
}

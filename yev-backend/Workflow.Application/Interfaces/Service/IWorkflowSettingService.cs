using Workflow.Application.Dtos.WorkflowSettings;

namespace Workflow.Application.Interfaces.Service
{
    public interface IWorkflowSettingService
    {
        Task<WorkflowSettingDto> GetAsync();
        Task<WorkflowSettingDto> UpdateAsync(UpdateWorkflowSettingDto request);
    }
}

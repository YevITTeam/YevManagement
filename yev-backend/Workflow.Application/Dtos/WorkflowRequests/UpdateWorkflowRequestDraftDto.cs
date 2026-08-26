using System.Text.Json;

namespace Workflow.Application.Dtos.WorkflowRequests
{
    public class UpdateWorkflowRequestDraftDto
    {
        public Dictionary<string, JsonElement> DataJson { get; set; } = new();
    }
}

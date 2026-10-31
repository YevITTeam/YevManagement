using System.ComponentModel.DataAnnotations;
using System.Text.Json;

namespace Workflow.Application.Dtos.WorkflowRequests
{
    // Raw JsonElement keeps the original JSON types; drafts are not validated, normalization against
    // FormFields happens only on Submit.
    public class CreateWorkflowRequestDraftDto
    {
        [Required(ErrorMessage = "FormDefinitionId không được để trống")]
        public int FormDefinitionId { get; set; }

        public Dictionary<string, JsonElement> DataJson { get; set; } = new();
    }
}

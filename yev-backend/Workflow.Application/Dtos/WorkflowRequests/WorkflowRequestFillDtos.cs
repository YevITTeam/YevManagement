using Workflow.Application.Dtos.FormFieldConditions;
using Workflow.Application.Dtos.FormFields;

namespace Workflow.Application.Dtos.WorkflowRequests
{
    // Requesters usually lack Workflow.FormDesign.View, so these are served behind Workflow.Request.Create,
    // filtered by IsPublished + FormAccesses.
    public class AvailableFormDto
    {
        public int Id { get; set; }
        public string Code { get; set; } = null!;
        public string NameVn { get; set; } = null!;
        public string? NameJp { get; set; }
        public string? FormCategoryNameVn { get; set; }
        public bool AllowAttachment { get; set; }
        public bool RequireAttachment { get; set; }
    }

    // Live fields/conditions (unlike the FormSchemaJson snapshot taken on submit), used while still Draft.
    public class WorkflowRequestFormSchemaDto
    {
        public int FormDefinitionId { get; set; }
        public string Code { get; set; } = null!;
        public string NameVn { get; set; } = null!;
        public string? NameJp { get; set; }
        public string? Description { get; set; }
        public bool AllowAttachment { get; set; }
        public bool RequireAttachment { get; set; }
        public string? LayoutHtml { get; set; }
        public List<FormFieldDto> Fields { get; set; } = new();
        public List<FormFieldConditionDto> Conditions { get; set; } = new();
    }

    // Lets the FE match "which participant is me" and pick the right direction of ApprovalDelegations.
    public class MyEmployeeDto
    {
        public int Id { get; set; }
        public string EmployeeCode { get; set; } = null!;
        public string FullName { get; set; } = null!;
    }
}

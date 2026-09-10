namespace Workflow.Application.Dtos.FormDefinitions
{
    // LayoutHtml là blob opaque (HTML render từ .docx nhúng data-field-key), không validate nội
    // dung — giống cách FormSchemaJson đang được coi là opaque (workflow-module.md §1.5).
    public class UpdateFormDefinitionLayoutDto
    {
        public string? LayoutHtml { get; set; }
    }
}

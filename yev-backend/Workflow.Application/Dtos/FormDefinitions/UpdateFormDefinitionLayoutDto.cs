namespace Workflow.Application.Dtos.FormDefinitions
{
    // LayoutHtml is an opaque blob (HTML rendered from .docx with data-field-key); content is not validated.
    public class UpdateFormDefinitionLayoutDto
    {
        public string? LayoutHtml { get; set; }
    }
}

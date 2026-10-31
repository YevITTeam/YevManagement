using System.ComponentModel.DataAnnotations;

namespace Workflow.Application.Dtos.FormDefinitions
{
    // Copies fields and conditions only; FormAccesses are deliberately not copied and must be configured per form.
    public class CloneFormDefinitionDto
    {
        [Required(ErrorMessage = "Mã form không được để trống")]
        public string Code { get; set; } = null!;

        [Required(ErrorMessage = "Tên form không được để trống")]
        public string NameVn { get; set; } = null!;

        public string? NameJp { get; set; }
    }
}

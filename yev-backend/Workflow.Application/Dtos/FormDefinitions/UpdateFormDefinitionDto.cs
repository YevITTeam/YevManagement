using System.ComponentModel.DataAnnotations;

namespace Workflow.Application.Dtos.FormDefinitions
{
    // KHÔNG có RouteConditionType — bất biến sau khi tạo (workflow-module.md §3.2). Đổi kiểu điều
    // kiện phải tạo FormDefinition mới.
    public class UpdateFormDefinitionDto
    {
        public int Id { get; set; }

        [Required(ErrorMessage = "Mã form không được để trống")]
        public string Code { get; set; } = null!;

        [Required(ErrorMessage = "Tên form không được để trống")]
        public string NameVn { get; set; } = null!;

        public string? NameJp { get; set; }

        [Required(ErrorMessage = "Danh mục form không được để trống")]
        public int FormCategoryId { get; set; }

        public string? Description { get; set; }

        public bool AllowAttachment { get; set; }

        public bool RequireAttachment { get; set; }

        [Required(ErrorMessage = "Tiền tố mã số không được để trống")]
        public string CodePrefix { get; set; } = null!;

        public string? RouteNumericFieldKey { get; set; }

        public string? RouteClassFieldKey { get; set; }
    }
}

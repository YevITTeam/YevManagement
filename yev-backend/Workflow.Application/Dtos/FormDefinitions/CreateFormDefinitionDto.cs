using System.ComponentModel.DataAnnotations;
using Workflow.Domain.Enums;

namespace Workflow.Application.Dtos.FormDefinitions
{
    public class CreateFormDefinitionDto
    {
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

        // BẤT BIẾN sau khi tạo — không có trong UpdateFormDefinitionDto (workflow-module.md §3.2).
        [Required(ErrorMessage = "Kiểu điều kiện rẽ nhánh không được để trống")]
        public RouteConditionType RouteConditionType { get; set; }

        public string? RouteNumericFieldKey { get; set; }

        public string? RouteClassFieldKey { get; set; }
    }
}

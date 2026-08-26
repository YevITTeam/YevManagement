using System.ComponentModel.DataAnnotations;

namespace Workflow.Application.Dtos.FormDefinitions
{
    // POST /FormDefinition/{id}/clone (workflow-module.md §6) — tạo 1 FormDefinition mới sao chép
    // FormFields + FormFieldConditions từ form nguồn. KHÔNG sao chép FormAccesses (ai tạo đơn được là
    // quyết định riêng cho từng form, phải cấu hình tay lại — cùng nguyên tắc "chỉ định tay, không suy
    // ra" áp dụng cho FormCategoryCoordinators ở §3.2).
    public class CloneFormDefinitionDto
    {
        [Required(ErrorMessage = "Mã form không được để trống")]
        public string Code { get; set; } = null!;

        [Required(ErrorMessage = "Tên form không được để trống")]
        public string NameVn { get; set; } = null!;

        public string? NameJp { get; set; }
    }
}

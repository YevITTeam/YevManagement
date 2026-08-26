using System.ComponentModel.DataAnnotations;
using System.Text.Json;

namespace Workflow.Application.Dtos.WorkflowRequests
{
    // DataJson gửi lên là object phẳng khoá = FieldKey (workflow-module.md §5.8) — nhận thô bằng
    // JsonElement để giữ nguyên kiểu JSON gốc (number/string/bool/array/object), Service tự validate
    // và chuẩn hoá lại theo FormFields lúc Submit. Ở bước tạo/sửa Draft KHÔNG validate/resolve gì cả —
    // đơn còn là bản nháp, dữ liệu có thể thiếu hoặc chưa đúng, chỉ chuẩn hoá lại đầy đủ khi Submit.
    public class CreateWorkflowRequestDraftDto
    {
        [Required(ErrorMessage = "FormDefinitionId không được để trống")]
        public int FormDefinitionId { get; set; }

        public Dictionary<string, JsonElement> DataJson { get; set; } = new();
    }
}

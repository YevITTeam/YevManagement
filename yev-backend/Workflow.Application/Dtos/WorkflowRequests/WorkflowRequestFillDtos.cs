using Workflow.Application.Dtos.FormFieldConditions;
using Workflow.Application.Dtos.FormFields;

namespace Workflow.Application.Dtos.WorkflowRequests
{
    // 3 DTO phục vụ Pha 3B-2 (FE nộp/duyệt đơn) — workflow-module.md §6: người nộp đơn thường KHÔNG có
    // quyền Workflow.FormDesign.View (chỉ người thiết kế form), nên không đọc được qua
    // FormDefinitionController. Đứng sau Workflow.Request.Create, tự lọc IsPublished + FormAccesses.
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

    // Field/condition SỐNG (khác FormSchemaJson đã snapshot lúc nộp) — dùng dựng màn điền đơn lúc còn
    // Draft, trước khi FormSchemaJson tồn tại (§3.3: NULL khi còn Draft).
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

    // {id} của Employee ứng với người đang đăng nhập — FE cần để so khớp "dòng participant nào là
    // tôi" và lọc đúng chiều ApprovalDelegations (GetMineAsync trả cả 2 chiều Delegator/Delegate).
    public class MyEmployeeDto
    {
        public int Id { get; set; }
        public string EmployeeCode { get; set; } = null!;
        public string FullName { get; set; } = null!;
    }
}

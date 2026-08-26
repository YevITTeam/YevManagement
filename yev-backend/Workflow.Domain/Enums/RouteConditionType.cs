namespace Workflow.Domain.Enums;

// workflow-module.md §4 — kiểu điều kiện rẽ nhánh của FormDefinition. BẤT BIẾN sau khi tạo (§3.2):
// đổi kiểu làm mọi FormRoutes đã cấu hình (Pha 3) trở nên vô nghĩa, muốn đổi phải tạo FormDefinition
// mới. Chưa dùng để rẽ nhánh thật ở Pha 2B (FormRoutes chưa scaffold) — chỉ lưu cấu hình.
public enum RouteConditionType
{
    None = 0,
    NumericRange = 1,
    ClassValue = 2,
    Both = 3
}

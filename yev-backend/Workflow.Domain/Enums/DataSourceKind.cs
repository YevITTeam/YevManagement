namespace Workflow.Domain.Enums;

// workflow-module.md §4 — nguồn dữ liệu cho FormFields.FormDataSourceId. SqlQuery giữ trong enum để
// khớp thiết kế §4 nhưng bị Service chặn tạo/sửa cho tới khi chốt được cơ chế bảo mật (tài khoản chỉ
// đọc, chặn từ khoá ghi, timeout) — xem workflow-module.md §3.2 FormDataSources.
public enum DataSourceKind
{
    Employees = 1,
    OrgUnits = 2,
    JobTitles = 3,
    SqlQuery = 4
}

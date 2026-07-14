namespace Attendance.Domain.Enums;

// Cấp duyệt theo thứ tự luồng: Submitter (người tạo đơn) -> LineManager -> DepartmentManager -> GeneralDirector.
public enum ApprovalLevel
{
    Submitter = 0,
    LineManager = 1,
    DepartmentManager = 2,
    GeneralDirector = 3
}

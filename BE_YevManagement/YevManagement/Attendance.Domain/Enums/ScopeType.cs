namespace Attendance.Domain.Enums;

// Loại phạm vi mà 1 UserApprovalScope trỏ tới (ScopeId tương ứng là Id của bảng nào).
// OtForm chỉ còn GroupId/DepartmentId (đã bỏ AreaId/LineId) nên ScopeType cũng chỉ còn 2 giá trị này.
public enum ScopeType
{
    Group = 0,
    Department = 1
}

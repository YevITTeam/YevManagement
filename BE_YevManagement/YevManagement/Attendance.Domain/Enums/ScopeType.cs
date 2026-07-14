namespace Attendance.Domain.Enums;

// Loại phạm vi mà 1 UserApprovalScope trỏ tới (ScopeId tương ứng là Id của bảng nào).
public enum ScopeType
{
    Area = 0,
    Line = 1,
    Group = 2,
    Department = 3
}

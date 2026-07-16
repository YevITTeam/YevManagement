using System.Collections.Generic;

namespace Attendance.Domain.Entities;

public partial class Employee
{
    public int Id { get; set; }

    public string Code { get; set; } = null!;

    public string FirstName { get; set; } = null!;

    public string LastName { get; set; } = null!;

    // Tài khoản AD của chính nhân viên này (nullable — không phải nhân viên nào cũng có tài khoản
    // đăng nhập). Dùng để cho phép nhân viên tự chỉnh lũy kế của chính mình (so khớp CurrentUserName).
    public string? UserName { get; set; }

    public decimal MonthToDate { get; set; }

    public decimal YearToDate { get; set; }

    // Tháng/năm mà MonthToDate/YearToDate hiện đang phản ánh — dùng để tự động rollover về 0 khi
    // OtForm được duyệt Completed rơi vào tháng/năm mới (xem OtFormService.AccumulateEmployeeHoursAsync).
    public int AccumulationYear { get; set; }

    public int AccumulationMonth { get; set; }

    // Nhóm cố định của nhân viên — BẮT BUỘC, để Trưởng Group liệt kê/chọn hàng loạt nhân viên của
    // mình khi lập đơn OT. Department suy ra qua Group.DepartmentId, không cần lưu trùng trên Employee.
    public int GroupId { get; set; }

    public bool IsDeleted { get; set; }

    public virtual Group Group { get; set; } = null!;

    public virtual ICollection<OtFormEmployee> OtFormEmployees { get; set; } = new List<OtFormEmployee>();
}

using System.Collections.Generic;

namespace Attendance.Domain.Entities;

public partial class Employee
{
    public int Id { get; set; }

    public string Code { get; set; } = null!;

    public string FirstName { get; set; } = null!;

    public string LastName { get; set; } = null!;

    public decimal MonthToDate { get; set; }

    public decimal YearToDate { get; set; }

    // Nhóm cố định của nhân viên — BẮT BUỘC, để Trưởng Group liệt kê/chọn hàng loạt nhân viên của
    // mình khi lập đơn OT. Department suy ra qua Group.DepartmentId, không cần lưu trùng trên Employee.
    public int GroupId { get; set; }

    public bool IsDeleted { get; set; }

    public virtual Group Group { get; set; } = null!;

    public virtual ICollection<OtFormEmployee> OtFormEmployees { get; set; } = new List<OtFormEmployee>();
}

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

    // Lũy kế DỰ KIẾN (2026-08-06) — cộng ngay khi đơn được TẠO (bất kể đơn đang ở trạng thái chưa
    // duyệt nào), trừ lại khi đơn bị Rejected hoặc khi 1 người bị loại khỏi đơn (RemoveEmployeeAsync),
    // điều chỉnh chênh lệch khi sửa "thực tích"/DidEat trước khi Trưởng phòng duyệt (UpdateAsync) —
    // xem OtFormService.ApplyProjectedDelta. Khác MonthToDate/YearToDate (chỉ cộng khi Completed):
    // mục đích để cảnh báo hạn mức thấy được CẢ những đơn khác đang treo chưa duyệt của cùng người,
    // tránh trường hợp tạo 2 đơn cùng lúc mà đơn nào cũng không thấy cảnh báo vì đơn kia chưa duyệt.
    public decimal ProjectedMonthToDate { get; set; }

    public decimal ProjectedYearToDate { get; set; }

    // Mốc rollover RIÊNG cho lũy kế dự kiến — tách khỏi AccumulationYear/Month vì lũy kế dự kiến có
    // thể bị trừ ngược (Reject/loại người) sau thời điểm cộng, nên không dùng chung mốc với lũy kế
    // thực tế (chỉ cộng 1 chiều, không bao giờ bị đảo ngược).
    public int ProjectedAccumulationYear { get; set; }

    public int ProjectedAccumulationMonth { get; set; }

    // Nhóm cố định của nhân viên — BẮT BUỘC, để Trưởng nhóm liệt kê/chọn hàng loạt nhân viên của
    // mình khi lập đơn OT. Department suy ra qua Group.DepartmentId, không cần lưu trùng trên Employee.
    public int GroupId { get; set; }

    public bool IsDeleted { get; set; }

    public virtual Group Group { get; set; } = null!;

    public virtual ICollection<OtFormEmployee> OtFormEmployees { get; set; } = new List<OtFormEmployee>();
}

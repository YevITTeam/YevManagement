namespace Attendance.Domain.Entities;

// Ledger append-only ghi lại số giờ OT lũy kế THẬT (không phải Dự kiến) theo từng (Employee, Năm,
// Tháng) — bù cho việc Employee.MonthToDate/YearToDate chỉ là bộ đếm SỐNG, bị ghi đè về 0 mỗi khi
// rollover sang tháng/năm mới nên không giữ được lịch sử tháng đã qua (2026-08-11d, xem
// docs/docs-be/attendance-module.md §Lịch sử lũy kế). Ghi dần từ thời điểm entity này ra đời — KHÔNG
// backfill dữ liệu cũ. 1 dòng/(EmployeeId, Year, Month), cộng dồn qua nhiều lần đơn Hoàn tất trong
// cùng tháng đó (xem OtFormService.AccumulateEmployeeHoursAsync). Mirror OtFormApprovalHistory: log
// audit thuần, KHÔNG có IsDeleted (không có khái niệm sửa/xoá 1 dòng qua UI, chỉ tăng dần).
public partial class EmployeeAccumulationHistory
{
    public int Id { get; set; }

    public int EmployeeId { get; set; }

    public int Year { get; set; }

    public int Month { get; set; }

    public decimal TotalHours { get; set; }

    public virtual Employee Employee { get; set; } = null!;
}

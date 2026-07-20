namespace Attendance.Application.Dtos.OtForms
{
    public class OtFormEmployeeDto
    {
        public int EmployeeId { get; set; }
        public string EmployeeCode { get; set; } = null!;
        public string FullName { get; set; } = null!;
        public TimeOnly StartTime { get; set; }
        public TimeOnly EndTime { get; set; }
        public string? NoteVn { get; set; }
        public string? NoteJp { get; set; }

        // Lũy kế HIỆN TẠI (live, không phải snapshot) của nhân viên — để người duyệt đối chiếu
        // ngưỡng TH3 (>25h/tháng, >300h/năm) ngay trên màn chi tiết đơn, không cần gọi thêm API Employee.
        public decimal MonthToDate { get; set; }
        public decimal YearToDate { get; set; }

        // Số giờ OT thực tế (EndTime - StartTime) > 2 giờ mới đủ điều kiện phiếu ăn — tính sẵn để FE
        // không phải tự trừ giờ (xem docs/attendance-module.md).
        public bool IsEligibleForMeal { get; set; }
    }
}

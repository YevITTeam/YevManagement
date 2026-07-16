using System.ComponentModel.DataAnnotations;

namespace Attendance.Application.Dtos.Employees
{
    // Cho phép ghi đè trực tiếp lũy kế tháng/năm của 1 nhân viên — dùng khi giờ OT thực tế đi làm
    // không khớp với giờ đã đăng ký trong OtForm. Gọi bởi chính nhân viên (UserName khớp) hoặc
    // người có quyền Attendance.Employee.Update (xem EmployeeService.AdjustAccumulationAsync).
    public class AdjustEmployeeAccumulationDto
    {
        [Range(0, double.MaxValue, ErrorMessage = "Lũy kế tháng không được âm")]
        public decimal MonthToDate { get; set; }

        [Range(0, double.MaxValue, ErrorMessage = "Lũy kế năm không được âm")]
        public decimal YearToDate { get; set; }
    }
}

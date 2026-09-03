using System.ComponentModel.DataAnnotations;

namespace Attendance.Application.Dtos.Employees
{
    // Sửa RIÊNG 2 field giới hạn OT/tháng/năm — tách khỏi UpdateEmployeeDto (2026-08-29) để cấp
    // permission hẹp (Attendance.Employee.UpdateOtLimit) cho Người phụ trách Bộ phận mà KHÔNG cho họ
    // sửa được Code/Tên/Group/... của nhân viên, xem EmployeeService.UpdateOtLimitAsync.
    public class UpdateEmployeeOtLimitDto
    {
        [Range(1, 744, ErrorMessage = "Giới hạn giờ OT/tháng riêng phải từ 1 đến 744")]
        public decimal? CustomMonthlyOtHourLimit { get; set; }

        [Range(1, 8784, ErrorMessage = "Giới hạn giờ OT/năm riêng phải từ 1 đến 8784")]
        public decimal? CustomYearlyOtHourLimit { get; set; }
    }
}

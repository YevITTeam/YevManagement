using System.ComponentModel.DataAnnotations;

namespace Attendance.Application.Dtos.Employees
{
    // Separate DTO so Department coordinators can edit OT limits without editing other employee fields.
    public class UpdateEmployeeOtLimitDto
    {
        [Range(1, 744, ErrorMessage = "Giới hạn giờ OT/tháng riêng phải từ 1 đến 744")]
        public decimal? CustomMonthlyOtHourLimit { get; set; }

        [Range(1, 8784, ErrorMessage = "Giới hạn giờ OT/năm riêng phải từ 1 đến 8784")]
        public decimal? CustomYearlyOtHourLimit { get; set; }
    }
}

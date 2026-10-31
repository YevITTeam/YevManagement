using System.ComponentModel.DataAnnotations;

namespace Attendance.Application.Dtos.EmployeeAccumulationHistories
{
    // Year total = InitialBalanceHours + 12 months; the FE derives InitialBalanceHours from the entered total.
    public class UpdateEmployeeAccumulationDto
    {
        [Range(2000, 2100, ErrorMessage = "Năm không hợp lệ")]
        public int Year { get; set; }

        [Range(0, 100000, ErrorMessage = "Số dư đầu kỳ phải từ 0 trở lên")]
        public decimal InitialBalanceHours { get; set; }

        [Required(ErrorMessage = "Thiếu danh sách tháng")]
        public List<EmployeeAccumulationHistoryDto> Months { get; set; } = new();
    }
}

using System.ComponentModel.DataAnnotations;

namespace Attendance.Application.Dtos.EmployeeAccumulationHistories
{
    // Sửa tay lũy kế của 1 nhân viên trong 1 năm: đặt lại số giờ từng tháng (1..12) và số dư đầu kỳ
    // (Month = 0 trong ledger). Tổng cả năm = InitialBalanceHours + tổng 12 tháng — FE cho nhập tổng
    // năm rồi tự quy ra InitialBalanceHours, BE chỉ nhận 2 thành phần này.
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

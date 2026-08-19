namespace Attendance.Application.Dtos.EmployeeAccumulationHistories
{
    public class EmployeeAccumulationHistoryYearDto
    {
        public int EmployeeId { get; set; }
        public string EmployeeCode { get; set; } = null!;
        public string EmployeeFullName { get; set; } = null!;
        public int Year { get; set; }

        // Luôn đủ 12 tháng (1..12), tháng chưa có dữ liệu = TotalHours 0 — điền ở Service, KHÔNG lưu
        // dòng rỗng trong DB (xem EmployeeAccumulationHistory).
        public List<EmployeeAccumulationHistoryDto> Months { get; set; } = new();

        // = Sum(Months.TotalHours) — cho năm CŨ (đã rollover) đây là nguồn DUY NHẤT để biết tổng giờ cả
        // năm đó, vì Employee.YearToDate chỉ còn phản ánh năm hiện tại. Cho năm hiện tại, giá trị này
        // luôn khớp Employee.YearToDate (cùng 1 điểm ghi — AccumulateEmployeeHoursAsync).
        public decimal YearTotalHours { get; set; }
    }
}

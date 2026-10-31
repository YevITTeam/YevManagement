namespace Attendance.Application.Dtos.EmployeeAccumulationHistories
{
    public class EmployeeAccumulationHistoryYearDto
    {
        public int EmployeeId { get; set; }
        public string EmployeeCode { get; set; } = null!;
        public string EmployeeFullName { get; set; } = null!;
        public int Year { get; set; }

        // Always 12 months; missing months are filled with 0 in the service, never stored as empty rows.
        public List<EmployeeAccumulationHistoryDto> Months { get; set; } = new();

        // For past years this is the only yearly total, since Employee.YearToDate reflects the current year only.
        public decimal YearTotalHours { get; set; }

        // Opening balance from import (stored as Month = 0).
        public decimal InitialBalanceHours { get; set; }
    }
}

using System;
using System.Collections.Generic;

namespace Attendance.Application.Dtos.OtForms
{
    public class CheckOtFormOverlapDto
    {
        public DateOnly Date { get; set; }
        
        // Giờ bắt đầu chung của đơn
        public TimeOnly StartTime { get; set; }

        public List<CheckOtFormOverlapEmployeeDto> Employees { get; set; } = new();

        public int? ExcludeFormId { get; set; }
    }

    public class CheckOtFormOverlapEmployeeDto
    {
        public int EmployeeId { get; set; }
        
        // Giờ kết thúc riêng của từng người
        public TimeOnly EndTime { get; set; }
    }
}

using System;
using System.Collections.Generic;

namespace Attendance.Application.Dtos.OtForms
{
    public class CheckOtFormOverlapDto
    {
        public DateOnly Date { get; set; }
        
        public TimeOnly StartTime { get; set; }

        public List<CheckOtFormOverlapEmployeeDto> Employees { get; set; } = new();

        public int? ExcludeFormId { get; set; }
    }

    public class CheckOtFormOverlapEmployeeDto
    {
        public int EmployeeId { get; set; }

        // Null = the form's StartTime.
        public TimeOnly? StartTime { get; set; }
        
        public TimeOnly EndTime { get; set; }
    }
}

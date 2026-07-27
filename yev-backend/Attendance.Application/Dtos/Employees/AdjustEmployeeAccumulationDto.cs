using System.ComponentModel.DataAnnotations;

namespace Attendance.Application.Dtos.Employees
{
    // Allows directly overwriting an employee's monthly/yearly accumulation — used when the actual
    // OT hours worked don't match the hours registered in the OtForm. Called either by the employee
    // themselves (matching UserName) or by someone with the Attendance.Employee.Update permission
    // (see EmployeeService.AdjustAccumulationAsync).
    public class AdjustEmployeeAccumulationDto
    {
        [Range(0, double.MaxValue, ErrorMessage = "Lũy kế tháng không được âm")]
        public decimal MonthToDate { get; set; }

        [Range(0, double.MaxValue, ErrorMessage = "Lũy kế năm không được âm")]
        public decimal YearToDate { get; set; }
    }
}

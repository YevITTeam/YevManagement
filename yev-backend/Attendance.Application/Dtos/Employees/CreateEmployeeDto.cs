using System.ComponentModel.DataAnnotations;

namespace Attendance.Application.Dtos.Employees
{
    public class CreateEmployeeDto
    {
        [Required(ErrorMessage = "Mã nhân viên không được để trống")]
        public string Code { get; set; } = null!;

        [Required(ErrorMessage = "Họ không được để trống")]
        public string FirstName { get; set; } = null!;

        [Required(ErrorMessage = "Tên không được để trống")]
        public string LastName { get; set; } = null!;

        // The employee's own AD account (nullable) — required if the employee should be able to
        // adjust their own accumulation later (see Attendance.OTForm/Employee adjust-accumulation).
        public string? UserName { get; set; }

        public decimal MonthToDate { get; set; }

        public decimal YearToDate { get; set; }

        [Required(ErrorMessage = "Nhóm không được để trống")]
        public int GroupId { get; set; }

        public int? JobTitleId { get; set; }
    }
}

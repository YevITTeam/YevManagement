using System.Collections.Generic;

namespace Attendance.Domain.Entities;

public partial class Employee
{
    public int Id { get; set; }

    public string Code { get; set; } = null!;

    public string FirstName { get; set; } = null!;

    public string LastName { get; set; } = null!;

    public decimal MonthToDate { get; set; }

    public decimal YearToDate { get; set; }

    public bool IsDeleted { get; set; }

    public virtual ICollection<OtFormEmployee> OtFormEmployees { get; set; } = new List<OtFormEmployee>();
}

using Attendance.Application.Dtos.Departments;
using Attendance.Application.Dtos.Groups;
using Attendance.Application.Dtos.Workshops;

namespace Attendance.Application.Dtos.Employees
{
    // Caller's actual employee scope so the FE narrows Department/Group filters to what GetPagedAsync returns.
    // Lists because the scope can span several Departments/Groups (own position + coordinator roles).
    public class EmployeeScopeDto
    {
        // Admin or company-wide levels: no restriction.
        public bool CompanyWide { get; set; }

        public List<DepartmentDto> Departments { get; set; } = new();

        // Includes child Groups of the Departments above plus directly coordinated Groups (possibly in other Departments).
        public List<GroupDto> Groups { get; set; } = new();

        // Workshops of the groups/pairs above, for the workshop filter.
        public List<WorkshopDto> Workshops { get; set; } = new();
    }
}

namespace Attendance.Application.Dtos.Employees
{
    // Scoped job-title assignment, unlike PUT /api/Employee/{id} (Admin-only full edit). Null = remove.
    public class AssignEmployeeJobTitleDto
    {
        public int? JobTitleId { get; set; }

        // Workshop to add to a Department Manager's scope; empty = the default (first) workshop.
        public int? WorkshopId { get; set; }
    }
}

namespace Attendance.Application.Dtos.Employees
{
    // Payload PUT /api/Employee/{id}/department-job-title và /{id}/group-job-title — gán/gỡ Chức vụ
    // CÓ PHẠM VI (2026-08-11c), khác hẳn PUT /api/Employee/{id} (sửa toàn bộ hồ sơ, chỉ Admin). null =
    // gỡ Chức vụ hiện tại.
    public class AssignEmployeeJobTitleDto
    {
        public int? JobTitleId { get; set; }

        // Workshop to add to a Department Manager's scope; empty = the default (first) workshop.
        public int? WorkshopId { get; set; }
    }
}

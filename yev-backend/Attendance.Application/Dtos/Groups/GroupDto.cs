namespace Attendance.Application.Dtos.Groups
{
    public class GroupDto
    {
        public int Id { get; set; }
        public string GroupCode { get; set; } = null!;
        public string GroupNameVn { get; set; } = null!;
        public string? GroupNameJp { get; set; }
        public int DepartmentId { get; set; }
        public string DepartmentNameVn { get; set; } = null!;
        public int? RequesterEmployeeId { get; set; }
        public string? RequesterFullName { get; set; }
        public int? ResponsibleEmployeeId { get; set; }
        public string? ResponsibleFullName { get; set; }
    }
}

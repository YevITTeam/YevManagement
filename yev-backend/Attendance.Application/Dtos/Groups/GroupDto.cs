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
        public int WorkshopId { get; set; }
        public string WorkshopNameVn { get; set; } = null!;
    }
}

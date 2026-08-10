namespace Attendance.Application.Dtos.JobTitlePermissions
{
    public class JobTitlePermissionDto
    {
        public int Id { get; set; }
        public int JobTitleId { get; set; }
        public string PermissionCode { get; set; } = null!;
    }
}

namespace Attendance.Application.Dtos.Reasons
{
    public class ReasonDto
    {
        public int Id { get; set; }
        public string ReasonNameVn { get; set; } = null!;
        public string? ReasonNameJp { get; set; }
    }
}

namespace Attendance.Application.Dtos.Workshops
{
    public class WorkshopDto
    {
        public int Id { get; set; }
        public string WorkshopCode { get; set; } = null!;
        public string WorkshopNameVn { get; set; } = null!;
        public string? WorkshopNameJp { get; set; }
    }
}

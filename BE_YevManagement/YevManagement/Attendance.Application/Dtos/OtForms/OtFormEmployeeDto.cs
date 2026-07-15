namespace Attendance.Application.Dtos.OtForms
{
    public class OtFormEmployeeDto
    {
        public int EmployeeId { get; set; }
        public string EmployeeCode { get; set; } = null!;
        public string FullName { get; set; } = null!;
        public TimeOnly StartTime { get; set; }
        public TimeOnly EndTime { get; set; }
        public string? NoteVn { get; set; }
        public string? NoteJp { get; set; }
    }
}

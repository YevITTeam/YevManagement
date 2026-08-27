namespace Attendance.Application.Dtos.JobTitles
{
    public class JobTitleDto
    {
        public int Id { get; set; }
        public string Code { get; set; } = null!;
        public string Name { get; set; } = null!;
        public int RankOrder { get; set; }

        // Enum Attendance.Domain.Enums.JobTitleTerminalLevel — None(0) nếu chỉ là cấp trung gian.
        public int TerminalLevel { get; set; }

        // true CHỈ cho "Line Leader" — xem JobTitle.cs.
        public bool IsLineScoped { get; set; }
    }
}

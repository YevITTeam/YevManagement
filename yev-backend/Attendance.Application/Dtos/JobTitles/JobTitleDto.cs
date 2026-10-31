namespace Attendance.Application.Dtos.JobTitles
{
    public class JobTitleDto
    {
        public int Id { get; set; }
        public string Code { get; set; } = null!;
        public string Name { get; set; } = null!;
        public int RankOrder { get; set; }

        // JobTitleTerminalLevel; None(0) for intermediate levels.
        public int TerminalLevel { get; set; }

        // True only for "Line Leader".
        public bool IsLineScoped { get; set; }
    }
}

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
        public bool AllowEatLater { get; set; }
        public string? LineKind { get; set; }
        public List<GroupLineDto> Lines { get; set; } = new();
    }

    // Codes are filled on read only.
    public class GroupLineDto
    {
        public int ProductionLineId { get; set; }
        public int ShiftTeamId { get; set; }
        public string? LineCode { get; set; }
        public string? ShiftTeamCode { get; set; }
    }
}

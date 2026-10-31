namespace Attendance.Application.Dtos.JobTitles
{
    // All active ids in the new order; RankOrder is reassigned 1..N.
    public class ReorderJobTitleDto
    {
        public List<int> JobTitleIds { get; set; } = new();
    }
}

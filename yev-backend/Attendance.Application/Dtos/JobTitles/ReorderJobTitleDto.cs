namespace Attendance.Application.Dtos.JobTitles
{
    // Toàn bộ Id chức vụ đang active, theo đúng thứ tự mới sau khi kéo-thả — BE gán lại
    // RankOrder = 1..N theo đúng thứ tự này (xem JobTitleService.ReorderAsync).
    public class ReorderJobTitleDto
    {
        public List<int> JobTitleIds { get; set; } = new();
    }
}

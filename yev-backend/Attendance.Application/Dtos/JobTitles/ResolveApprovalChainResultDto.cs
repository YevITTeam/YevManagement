namespace Attendance.Application.Dtos.JobTitles
{
    public class ResolveApprovalChainResultDto
    {
        // false nếu chuỗi bị "kẹt" — chưa có ai giữ đúng Chức vụ ở 1 cấp nào đó trong Department,
        // hoặc chưa có ai giữ Chức vụ cấp duyệt cuối tương ứng (xem Warning).
        public bool IsComplete { get; set; }

        public List<ResolvedApprovalStepDto> Steps { get; set; } = new();

        public string? Warning { get; set; }
    }
}

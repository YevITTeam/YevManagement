namespace Attendance.Application.Dtos.JobTitles
{
    public class ResolveApprovalChainResultDto
    {
        // false nếu chuỗi bị "kẹt" — chưa có ai giữ đúng Chức vụ ở 1 cấp nào đó trong Department,
        // hoặc chưa có ai giữ Chức vụ cấp duyệt cuối tương ứng (xem Warning).
        public bool IsComplete { get; set; }

        public List<ResolvedApprovalStepDto> Steps { get; set; } = new();

        public string? Warning { get; set; }

        // true khi TOÀN BỘ Chức vụ trung gian "Bắt buộc ký" đã cấu hình cho Department này có RankOrder
        // <= cấp của chính người tạo — tức người tạo đã ở cấp cao hơn/bằng mọi người đáng lẽ phải ký ô
        // "Người đề nghị", không còn ai khác để ký thay. Người tạo tự trở thành người ký ô đó (và mặc
        // định là "Người chịu trách nhiệm" qua fallback createdByFullName có sẵn ở OtFormPrintView.tsx)
        // — xem OtFormService.CreateAsync (2026-08-08, theo yêu cầu người dùng).
        public bool RequiresCreatorSelfSign { get; set; }
    }
}

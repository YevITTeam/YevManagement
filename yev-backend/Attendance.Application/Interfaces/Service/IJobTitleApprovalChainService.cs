using Attendance.Application.Dtos.JobTitles;

namespace Attendance.Application.Interfaces.Service
{
    public interface IJobTitleApprovalChainService
    {
        // Suy luận chuỗi duyệt tự động cho 1 nhân viên tạo đơn + 1 OtCase — READ-ONLY, không tạo/sửa
        // gì trên OtForm. Dùng để test/xem trước cây Chức vụ trước khi wiring thật vào OtFormService
        // (xem docs/docs-be/attendance-module.md §Cây chức vụ — Giai đoạn 2).
        Task<ResolveApprovalChainResultDto> ResolveChainAsync(int creatorEmployeeId, int otCaseId);
    }
}

using Attendance.Application.Dtos.JobTitles;

namespace Attendance.Application.Interfaces.Service
{
    public interface IJobTitleApprovalChainService
    {
        // Suy luận chuỗi duyệt tự động cho 1 nhân viên tạo đơn + 1 OtCase — READ-ONLY, không tạo/sửa
        // gì trên OtForm. Dùng để test/xem trước cây Chức vụ (màn "Thử chuỗi duyệt"). Ném DomainException
        // nếu creatorEmployeeId không tồn tại hoặc chưa gán Chức vụ — cố ý "fail loud" vì đây là công cụ
        // kiểm tra dữ liệu, không phải luồng tạo đơn thật (xem docs/docs-be/attendance-module.md §Cây chức vụ).
        Task<ResolveApprovalChainResultDto> ResolveChainAsync(int creatorEmployeeId, int otCaseId);

        // Bản MỀM dùng bởi OtFormService.CreateAsync (2026-08-07, Giai đoạn 3.1) — KHÔNG ném lỗi nếu
        // creatorEmployeeId null (Admin tạo hộ, không phải Nhân viên của Group đó) hoặc nhân viên chưa
        // gán Chức vụ: coi như đang ở cấp thấp nhất (không loại bước nào khỏi cây duyệt của Department).
        // departmentId truyền trực tiếp (không suy ra qua Employee.Group) vì OtFormService đã có sẵn và
        // đã validate đúng Department của đơn.
        Task<ResolveApprovalChainResultDto> ResolveChainForCreationAsync(int? creatorEmployeeId, int departmentId, int otCaseId);
    }
}

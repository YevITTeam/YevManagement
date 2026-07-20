namespace Attendance.Domain.Enums;

// Cấp duyệt theo thứ tự tuần tự thấp -> cao: Submitter (Trưởng nhóm, ký "Người đề nghị") -> GroupHead
// (Trưởng Bộ phận, MỚI 2026-07-17) -> DepartmentManager (Trưởng phòng) -> WorkshopManager (Trưởng
// xưởng) -> GeneralDirector (Tổng Giám Đốc). OtCase.RequiredApprovalLevel quyết định đơn phải đi tới
// cấp nào thì dừng (chỉ nhận DepartmentManager/WorkshopManager/GeneralDirector — xem docs/attendance-module.md
// — phiếu YEV-22-024 TH1/TH2/TH3); GroupHead luôn là bước bắt buộc trung gian, không phải điểm dừng.
// GroupHead gán số 4 (thêm cuối) thay vì chèn giữa Submitter/DepartmentManager để không đổi giá trị
// int của các cấp cũ đã lưu DB (cùng nguyên tắc OtFormStatus.Draft = 5).
public enum ApprovalLevel
{
    Submitter = 0,
    DepartmentManager = 1,
    WorkshopManager = 2,
    GeneralDirector = 3,
    GroupHead = 4
}

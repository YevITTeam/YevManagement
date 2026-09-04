namespace Attendance.Application.Dtos.ProductionEmployees
{
    // Sửa tay Line/Team/Nhóm ca/Trưởng nhóm của 1 dòng "Nhân viên dưới chuyền" (2026-09-04, theo yêu
    // cầu người dùng) — bổ sung cho luồng Import Excel hiện có, dùng khi cần sửa nhanh 1-2 người giữa
    // 2 đợt import mà không phải nạp lại cả file. 3 FK đều nullable (đúng shape ProductionEmployee —
    // vd BlockCode/ProductionLineId để trống với các mã trạm hành chính không phải Line vật lý).
    // KHÔNG nhận CongDoan/TaskName — 2 field đó chỉ mang tính mô tả từ file gốc, không ảnh hưởng nghiệp
    // vụ (lọc/duyệt), giữ nguyên như import gần nhất cho tới lần import kế tiếp.
    public class UpdateProductionEmployeeDto
    {
        public int? ProductionLineId { get; set; }
        public int? TeamId { get; set; }
        public int? ShiftTeamId { get; set; }
        public bool IsLeader { get; set; }
    }
}

namespace Attendance.Domain.Entities;

// Cây duyệt CẤU HÌNH TAY cho từng Bộ phận — CHỈ chứa 3 cấp duyệt CUỐI (Manager/Factory
// Manager/Director, JobTitle.TerminalLevel != None). 3 cấp trung gian dưới Manager cấu hình ở
// GroupApprovalStep theo từng Nhóm con thay vì ở đây (2026-08-08 — trước đó gộp chung cả cấp trung
// gian lẫn cấp cuối trong 1 Bộ phận, khiến ứng viên cấp trung gian bị lẫn giữa các Nhóm không liên
// quan). Mỗi dòng = 1 bước duyệt cố định của 1 Department, theo đúng thứ tự StepOrder Admin sắp
// xếp. Quản lý theo kiểu "thay nguyên danh sách" (xem IDepartmentApprovalStepService.ReplaceAsync)
// — không có Create/Update/Delete từng dòng riêng lẻ.
public partial class DepartmentApprovalStep
{
    public int Id { get; set; }

    public int DepartmentId { get; set; }

    public int StepOrder { get; set; }

    public int JobTitleId { get; set; }

    // Bắt buộc ký tay (UserSignature) hay chỉ cần xác nhận ở BƯỚC này — cấu hình riêng theo từng
    // Phòng ban (2026-08-07, chuyển từ JobTitle.RequiresSignature xuống đây — phản hồi người dùng:
    // cùng 1 Chức vụ có thể cần ký ở Phòng ban này nhưng chỉ cần xác nhận ở Phòng ban khác, nên cờ
    // này không thể gắn cứng vào Chức vụ toàn cục được nữa).
    public bool RequiresSignature { get; set; }

    public bool IsDeleted { get; set; }

    public virtual Department Department { get; set; } = null!;

    public virtual JobTitle JobTitle { get; set; } = null!;
}

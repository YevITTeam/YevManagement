namespace Attendance.Domain.Entities;

// Cây duyệt CẤU HÌNH TAY cho từng Phòng ban (2026-08-06, thay cho việc tự bắc cầu qua mọi RankOrder
// đang có người giữ — xem JobTitle.RankOrder). Mỗi dòng = 1 bước duyệt cố định của 1 Department, theo
// đúng thứ tự StepOrder Admin sắp xếp. Quản lý theo kiểu "thay nguyên danh sách" (xem
// IDepartmentApprovalStepService.ReplaceAsync) — không có Create/Update/Delete từng dòng riêng lẻ.
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

    // Đánh dấu BƯỚC này là "người chịu trách nhiệm" trên form in — Admin tự chọn tường minh 1 bước
    // duy nhất trong cây duyệt của Phòng ban (2026-08-07). Tối đa 1 bước/Department được đánh dấu
    // (validate ở DepartmentApprovalStepService.ReplaceAsync), có thể để trống nếu Phòng ban chưa
    // xác định. Sẽ thay cho pattern snapshot "Trưởng nhóm cấp 0" cũ (OtFormApprovalHistory) khi Giai
    // đoạn 3 wiring chuỗi mới vào OtFormService thật.
    public bool IsResponsible { get; set; }

    public bool IsDeleted { get; set; }

    public virtual Department Department { get; set; } = null!;

    public virtual JobTitle JobTitle { get; set; } = null!;
}

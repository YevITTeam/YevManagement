using System.Collections.Generic;

namespace Attendance.Domain.Entities;

// Master data cho cây chức vụ dùng để tự suy luận chuỗi duyệt OT (thay thế UserApprovalScope thủ
// công) — xem plan "Cây Chức vụ" trong docs/docs-be/attendance-module.md.
public partial class JobTitle
{
    public int Id { get; set; }

    public string Code { get; set; } = null!;

    public string Name { get; set; } = null!;

    // Cấp độ (CapDo) — số càng lớn càng cao. Dùng để suy luận chuỗi duyệt: từ người tạo đơn, đi qua
    // các RankOrder tăng dần đang có người giữ trong cùng Department, bắc cầu qua cấp trống.
    public int RankOrder { get; set; }

    // Cấp này khi duyệt có bắt buộc chữ ký tay (UserSignature) hay chỉ cần xác nhận — Admin tự cấu
    // hình, không hardcode theo Code (xem GuardExtensions/JobTitleService).
    public bool RequiresSignature { get; set; }

    // Enum Attendance.Domain.Enums.JobTitleTerminalLevel — None nếu chỉ là cấp trung gian.
    public int TerminalLevel { get; set; }

    public bool IsDeleted { get; set; }

    public virtual ICollection<Employee> Employees { get; set; } = new List<Employee>();
}

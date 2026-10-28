using System;
using System.Collections.Generic;

namespace Attendance.Domain.Entities;

public partial class OtForm
{
    public int Id { get; set; }

    // Nullable khi IsProductionForm = true (đơn "theo chuyền", Chế tạo) — đơn loại này không gắn 1
    // Group cố định (Employee.GroupId của người tạo/người tham gia có thể khác nhau, xem
    // ProductionApprovalStep) — 2026-08-24. Đơn "theo Nhóm" (văn phòng, IsProductionForm = false)
    // vẫn bắt buộc có GroupId như trước.
    public int? GroupId { get; set; }

    // true = đơn tạo theo chế độ "chuyền" (chọn người qua ProductionEmployee, không qua Group cố
    // định) — quyết định tường minh, KHÔNG suy ngầm từ GroupId == null, để mọi nơi đọc dữ liệu (báo
    // cáo, in PDF, danh sách đơn...) biết chắc loại đơn mà không cần đoán qua giá trị null.
    public bool IsProductionForm { get; set; }

    public int DepartmentId { get; set; }

    // Workshop of the form: the group's workshop, or (production forms) the participants' common workshop.
    public int WorkshopId { get; set; }

    public int ReasonId { get; set; }

    public int OtCaseId { get; set; }

    public TimeOnly StartTime { get; set; }

    public TimeOnly EndTime { get; set; }

    public string? SubReason { get; set; }

    public decimal TotalHour { get; set; }

    public DateOnly Date { get; set; }

    public int NumberOfEmployee { get; set; }

    // The form creator — stores UserName (Identity.User lives in a different DB, and the JWT has no
    // numeric UserId claim, only UserName), following the same convention as
    // Asset.Domain.Models.AuditTrail.ChangedBy.
    public string CreatedByUserName { get; set; } = null!;

    // Snapshot of the JWT's "FullName" claim at the time the form was created — so every display
    // (list/detail) can always show the user's name instead of the raw UserName, same reasoning as
    // OtFormApprovalHistory.ApproverFullName.
    public string? CreatedByFullName { get; set; }

    // Thời điểm tạo đơn (UTC) — dùng làm "thời gian ký" hiển thị trên bản in cho trường hợp tự ký
    // (CreatorSignatureImage, không có OtFormApprovalHistory tương ứng để lấy ActionAt) — xem
    // OtFormPrintView.tsx SignatureCell (2026-08-20).
    public DateTime CreatedAt { get; set; }

    // Snapshot ảnh chữ ký của CHÍNH người tạo đơn (từ UserSignature lúc tạo) — chỉ có giá trị khi
    // JobTitleApprovalChainService đánh giá người tạo đã ở cấp cao hơn/bằng MỌI Chức vụ trung gian
    // "Bắt buộc ký" đã cấu hình cho Phòng ban (không còn ai khác để ký ô "Người đề nghị" thay họ) —
    // xem ResolveApprovalChainResultDto.RequiresCreatorSelfSign, OtFormService.CreateAsync (2026-08-08,
    // theo yêu cầu người dùng). "Người chịu trách nhiệm" dùng chung field này qua fallback
    // createdByFullName có sẵn ở OtFormPrintView.tsx, không cần field riêng.
    public byte[]? CreatorSignatureImage { get; set; }

    // Stores the Attendance.Domain.Enums.OtFormStatus enum as an int (following the same convention as
    // Asset.Domain.Entities.Device.Status).
    public int Status { get; set; }

    public bool IsDeleted { get; set; }

    // Admin xoá đơn thủ công (2026-08-08) — dùng cho đơn kẹt vĩnh viễn (chuỗi duyệt thiếu candidate ở 1
    // bước, không có cách resolve lại) vì candidate đã snapshot 1 lần lúc tạo. Chỉ Admin có quyền
    // (Attendance.OTForm.Delete), chỉ áp dụng cho đơn CHƯA Completed (đơn Completed đã cộng lũy kế thật,
    // xoá sẽ làm sai số liệu — chặn ở Service). Set cùng lúc với IsDeleted=true, giữ nguyên toàn bộ dữ
    // liệu đơn (soft-delete, không mất audit trail — xem OtFormEmployee.RemovedAt cùng triết lý).
    public string? DeletedByUserName { get; set; }

    public string? DeletedByFullName { get; set; }

    public DateTime? DeletedAt { get; set; }

    public string? DeleteReason { get; set; }

    // "Đơn tổng" this form was swept into, once it reaches OtFormStatus.Pending (awaiting Department
    // Manager) — null until the daily sweep picks it up (see docs/attendance-module.md — §Đơn tổng).
    public int? OtFormBatchId { get; set; }

    public virtual Group? Group { get; set; }

    public virtual Department Department { get; set; } = null!;

    public virtual Workshop Workshop { get; set; } = null!;

    public virtual Reason Reason { get; set; } = null!;

    public virtual OtCase OtCase { get; set; } = null!;

    public virtual OtFormBatch? OtFormBatch { get; set; }

    public virtual ProcessPart? ProcessPart { get; set; }

    public virtual ICollection<OtFormEmployee> OtFormEmployees { get; set; } = new List<OtFormEmployee>();

    public virtual ICollection<OtFormApprovalHistory> OtFormApprovalHistories { get; set; } = new List<OtFormApprovalHistory>();

    public virtual ICollection<OtFormEditLog> OtFormEditLogs { get; set; } = new List<OtFormEditLog>();

    public virtual ICollection<OtFormApprovalEmailToken> OtFormApprovalEmailTokens { get; set; } = new List<OtFormApprovalEmailToken>();

    // Chuỗi bước duyệt đã snapshot lúc tạo đơn (2026-08-07, Giai đoạn 3.1) — xem OtFormApprovalStep.
    public virtual ICollection<OtFormApprovalStep> ApprovalSteps { get; set; } = new List<OtFormApprovalStep>();

    // Cảnh báo suy luận chuỗi lúc tạo đơn (Phòng ban chưa cấu hình đủ cây duyệt / thiếu người giữ
    // đúng Chức vụ) — snapshot 1 lần, không tính lại (2026-08-07). Null nếu chuỗi đầy đủ. Không tự
    // fallback về cơ chế cũ — đơn vẫn được tạo nhưng "kẹt" ở bước không có candidate nào, Admin phải bổ
    // sung cấu hình rồi mới đi tiếp (xem docs/attendance-module.md §Cây chức vụ, plan §3 quyết định #10).
    public string? ApprovalChainWarning { get; set; }
}

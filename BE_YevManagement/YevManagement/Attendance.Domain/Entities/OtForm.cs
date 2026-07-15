using System;
using System.Collections.Generic;

namespace Attendance.Domain.Entities;

public partial class OtForm
{
    public int Id { get; set; }

    public int GroupId { get; set; }

    public int DepartmentId { get; set; }

    public int ReasonId { get; set; }

    public int OtCaseId { get; set; }

    public TimeOnly StartTime { get; set; }

    public TimeOnly EndTime { get; set; }

    public string? SubReason { get; set; }

    public decimal TotalHour { get; set; }

    public DateOnly Date { get; set; }

    public int NumberOfEmployee { get; set; }

    // Người tạo đơn — lưu UserName (Identity.User nằm ở DB khác, JWT không có claim UserId dạng số,
    // chỉ có UserName), theo đúng convention Asset.Domain.Models.AuditTrail.ChangedBy.
    public string CreatedByUserName { get; set; } = null!;

    // Lưu enum Attendance.Domain.Enums.OtFormStatus dưới dạng int (theo convention Asset.Domain.Entities.Device.Status).
    public int Status { get; set; }

    public bool IsDeleted { get; set; }

    public virtual Group Group { get; set; } = null!;

    public virtual Department Department { get; set; } = null!;

    public virtual Reason Reason { get; set; } = null!;

    public virtual OtCase OtCase { get; set; } = null!;

    public virtual ProcessPart? ProcessPart { get; set; }

    public virtual ICollection<OtFormEmployee> OtFormEmployees { get; set; } = new List<OtFormEmployee>();

    public virtual ICollection<OtFormApprovalHistory> OtFormApprovalHistories { get; set; } = new List<OtFormApprovalHistory>();
}

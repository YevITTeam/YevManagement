using System;
using System.Collections.Generic;

namespace Attendance.Domain.Entities;

public partial class OtForm
{
    public int Id { get; set; }

    public int AreaId { get; set; }

    public int LineId { get; set; }

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

    // Người tạo đơn, tham chiếu Identity.User (khác DB, không có FK constraint thật — xem docs/attendance-module.md).
    public int CreatedByUserId { get; set; }

    // Lưu enum Attendance.Domain.Enums.OtFormStatus dưới dạng int (theo convention Asset.Domain.Entities.Device.Status).
    public int Status { get; set; }

    public bool IsDeleted { get; set; }

    public virtual Area Area { get; set; } = null!;

    public virtual Line Line { get; set; } = null!;

    public virtual Group Group { get; set; } = null!;

    public virtual Department Department { get; set; } = null!;

    public virtual Reason Reason { get; set; } = null!;

    public virtual OtCase OtCase { get; set; } = null!;

    public virtual ProcessPart? ProcessPart { get; set; }

    public virtual ICollection<OtFormEmployee> OtFormEmployees { get; set; } = new List<OtFormEmployee>();

    public virtual ICollection<OtFormApprovalHistory> OtFormApprovalHistories { get; set; } = new List<OtFormApprovalHistory>();
}

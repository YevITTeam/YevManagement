using System;

namespace Attendance.Domain.Entities;

// List of employees participating in an OtForm along with each person's actual OT hours — composite key (OtFormId, EmployeeId).
public partial class OtFormEmployee
{
    public int OtFormId { get; set; }

    public int EmployeeId { get; set; }

    public TimeOnly StartTime { get; set; }

    public TimeOnly EndTime { get; set; }

    // Có dùng phiếu ăn (ăn tại công ty) hay không — chỉ có ý nghĩa khi giờ OT thực tế của người này
    // (EndTime - StartTime) >= AttendanceSetting.MainMealTicketMinHours; dưới ngưỡng thì field này
    // không được dùng tới ở đâu cả. Nhập lúc tạo đơn, sửa được cùng lúc với EndTime tới trước khi
    // Trưởng phòng duyệt (xem OtFormService.UpdateAsync — Sửa đơn: giới hạn chỉ sửa thực tích).
    // Khi Completed, nếu đủ ngưỡng mà DidEat=false thì +30 phút vào lũy kế (MonthToDate/YearToDate) —
    // xem AccumulateEmployeeHoursAsync. Không liên quan ProcessPart.IsEat (cờ "có phục vụ ăn" chung
    // cho cả đơn, người lập đơn tick tay, không theo từng người).
    public bool DidEat { get; set; }

    public string? NoteVn { get; set; }

    public string? NoteJp { get; set; }

    // Snapshot of Employee.ProjectedMonthToDate/ProjectedYearToDate (NOT MonthToDate/YearToDate —
    // changed 2026-08-06) at the moment this row was added to the form, BEFORE this form's own hours
    // were reserved into the projected total — frozen so viewing an old form always shows "how much
    // this person already had pending (including OTHER not-yet-decided forms) right before this one",
    // not whatever the Employee's projected accumulation happens to be right now (same principle as
    // OtFormApprovalHistory.SignatureImage/ApproverFullName being snapshots, not live joins).
    public decimal MonthToDate { get; set; }

    public decimal YearToDate { get; set; }

    // === Removed-by-approver block (see docs/attendance-module.md — Loại nhân viên khỏi đơn) ===
    // An approver who disagrees with ONE person out of many no longer has to reject the whole form:
    // they drop that person and approve the rest. This is a SOFT removal (the row stays) — the form is
    // a legal document, so who was dropped, by whom, at which level and why must remain traceable
    // forever. Everything downstream (accumulation, NumberOfEmployee, the printed PDF) filters on
    // IsRemoved; nothing hard-deletes the row.
    public bool IsRemoved { get; set; }

    public string? RemovedByUserName { get; set; }

    public string? RemovedByFullName { get; set; }

    // ApprovalLevel the remover was acting at when they dropped this person (Submitter/GroupHead/
    // DepartmentManager/WorkshopManager/GeneralDirector) — stored as int, same convention as
    // OtFormApprovalHistory.ApprovalLevel.
    public int? RemovedAtLevel { get; set; }

    public DateTime? RemovedAt { get; set; }

    public string? RemoveReason { get; set; }

    public virtual OtForm OtForm { get; set; } = null!;

    public virtual Employee Employee { get; set; } = null!;
}

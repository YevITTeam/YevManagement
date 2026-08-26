namespace Workflow.Domain.Entities;

public partial class JobTitle
{
    public int Id { get; set; }

    public string Code { get; set; } = null!;

    public string NameVn { get; set; } = null!;

    public string? NameJp { get; set; }

    // Thứ bậc — số nhỏ = cao hơn. CHỈ để hiển thị/sắp xếp, KHÔNG dùng suy luận luồng duyệt
    // (workflow-module.md §1.6: đã bỏ OrgUnitScope = ApplicantAncestor).
    public int RankOrder { get; set; }

    // true = tại 1 đơn vị chỉ 1 người được giữ chức danh này cùng lúc (EmployeeService.
    // ReplaceOrgUnitsAsync enforce) — BẮT BUỘC cho chức danh dùng làm mốc route duyệt (§5.5
    // ParticipantSource=JobTitle cần resolve ra đúng 1 người). false = chức danh phổ thông, nhiều
    // người cùng giữ được (vd "Nhân viên"). Mặc định true để giữ nguyên hành vi cũ cho dữ liệu có sẵn
    // (chốt 2026-08-26, xem workflow-module.md §10 — phát hiện khi 1 chức danh phổ thông không gán
    // được cho người thứ 2 trong cùng đơn vị).
    public bool IsUniquePerOrgUnit { get; set; } = true;

    public bool IsDeleted { get; set; }

    public virtual ICollection<EmployeeOrgUnit> EmployeeOrgUnits { get; set; } = new List<EmployeeOrgUnit>();

    public virtual ICollection<FormApprovalStepParticipant> FormApprovalStepParticipants { get; set; } = new List<FormApprovalStepParticipant>();
}

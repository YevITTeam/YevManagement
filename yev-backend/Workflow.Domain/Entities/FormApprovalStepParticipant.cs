using Workflow.Domain.Enums;

namespace Workflow.Domain.Entities;

// Ai đứng ở 1 bước duyệt (workflow-module.md §3.2). JobTitle là tầng gián tiếp quan trọng nhất của
// thiết kế: form ghi "bước 2 = Trưởng phòng", ai đang giữ chức đó tra ở EmployeeOrgUnits lúc resolve
// (Pha 3B §5.5) — đổi trưởng phòng chỉ sửa 1 dòng, không phải mở lại từng form.
public partial class FormApprovalStepParticipant
{
    public int Id { get; set; }

    public int FormApprovalStepId { get; set; }

    public ParticipantSource ParticipantSource { get; set; }

    public int? EmployeeId { get; set; }

    public int? JobTitleId { get; set; }

    public ParticipantRole ParticipantRole { get; set; }

    public int SortOrder { get; set; }

    public bool IsDeleted { get; set; }

    public virtual FormApprovalStep FormApprovalStep { get; set; } = null!;

    public virtual Employee? Employee { get; set; }

    public virtual JobTitle? JobTitle { get; set; }
}

namespace Workflow.Domain.Entities;

// Nhân sự x đơn vị x chức danh (kiêm nhiệm 兼務). Bảng duy nhất trả lời "ai đang là Trưởng phòng
// Kế toán" — xem workflow-module.md §3.1. Ràng buộc "1 Employee tối đa 1 dòng IsPrimary=1 còn hiệu
// lực" và "1 cặp (OrgUnitId, JobTitleId) chỉ 1 người tại 1 thời điểm" validate ở Service, KHÔNG ở DB,
// vì có thời hiệu (ValidFrom/ValidTo).
public partial class EmployeeOrgUnit
{
    public int Id { get; set; }

    public int EmployeeId { get; set; }

    public int OrgUnitId { get; set; }

    public int? JobTitleId { get; set; }

    public bool IsPrimary { get; set; }

    public DateTime? ValidFrom { get; set; }

    public DateTime? ValidTo { get; set; }

    public bool IsDeleted { get; set; }

    public virtual Employee Employee { get; set; } = null!;

    public virtual OrgUnit OrgUnit { get; set; } = null!;

    public virtual JobTitle? JobTitle { get; set; }
}

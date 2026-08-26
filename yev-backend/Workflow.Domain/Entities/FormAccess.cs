using Workflow.Domain.Enums;

namespace Workflow.Domain.Entities;

// Ai được TẠO ĐƠN form này (workflow-module.md §3.2) — khác FormCategoryCoordinators (ai SỬA được
// cấu hình form). Quản lý kiểu "thay nguyên danh sách" (ReplaceAsync), không Create/Update/Delete
// từng dòng. Đúng 1 trong 3 cột đích khác NULL theo TargetType, Service tự validate.
public partial class FormAccess
{
    public int Id { get; set; }

    public int FormDefinitionId { get; set; }

    public AccessTargetType TargetType { get; set; }

    // Cross-DB -> Identity.Roles.Id, KHÔNG FK thật (workflow-module.md §1.4/§3.2).
    public int? RoleId { get; set; }

    public int? OrgUnitId { get; set; }

    public int? EmployeeId { get; set; }

    public bool IsDeleted { get; set; }

    public virtual FormDefinition FormDefinition { get; set; } = null!;

    public virtual OrgUnit? OrgUnit { get; set; }

    public virtual Employee? Employee { get; set; }
}

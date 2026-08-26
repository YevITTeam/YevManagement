namespace Workflow.Domain.Entities;

// Ai được THIẾT KẾ form của thư mục này — chỉ định tay, không suy theo chức danh
// (workflow-module.md §3.2). Quản lý kiểu "thay nguyên danh sách", không Create/Update/Delete từng dòng.
public partial class FormCategoryCoordinator
{
    public int Id { get; set; }

    public int FormCategoryId { get; set; }

    public int EmployeeId { get; set; }

    public bool IsDeleted { get; set; }

    public virtual FormCategory FormCategory { get; set; } = null!;

    public virtual Employee Employee { get; set; } = null!;
}

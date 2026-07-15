using System.Collections.Generic;

namespace Attendance.Domain.Entities;

public partial class OtCase
{
    public int Id { get; set; }

    public string Code { get; set; } = null!;

    public string? Description { get; set; }

    // Quyết định luồng duyệt của OtForm dùng OtCase này có bắt buộc ký tay (SignatureImage) hay không.
    public bool RequireSignature { get; set; }

    // Cấp duyệt CUỐI CÙNG mà OtForm dùng OtCase này phải đạt tới (enum Attendance.Domain.Enums.ApprovalLevel,
    // lưu dạng int). Đơn vẫn đi tuần tự Submitter -> DepartmentManager -> WorkshopManager -> GeneralDirector,
    // dừng lại khi đạt cấp này (VD: TH1=DepartmentManager, TH2=WorkshopManager, TH3=GeneralDirector).
    public int RequiredApprovalLevel { get; set; }

    public bool IsDeleted { get; set; }

    public virtual ICollection<OtForm> OtForms { get; set; } = new List<OtForm>();
}

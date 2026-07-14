using System.Collections.Generic;

namespace Attendance.Domain.Entities;

public partial class OtCase
{
    public int Id { get; set; }

    public string Code { get; set; } = null!;

    public string? Description { get; set; }

    // Quyết định luồng duyệt của OtForm dùng OtCase này có bắt buộc ký tay (SignatureImage) hay không.
    public bool RequireSignature { get; set; }

    public bool IsDeleted { get; set; }

    public virtual ICollection<OtForm> OtForms { get; set; } = new List<OtForm>();
}

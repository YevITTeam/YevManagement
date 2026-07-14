using System;

namespace Identity.Domain.Entities;

public partial class UserPermission
{
    public int UserId { get; set; }

    public int PermissionId { get; set; }

    // true = cấp thêm permission này cho riêng User này dù Role không có.
    // false = thu hồi permission này khỏi riêng User này dù Role có cấp.
    // Deny (false) luôn thắng Grant khi tính permission hiệu lực (xem MyClaimsTransformation).
    public bool IsGranted { get; set; }

    public virtual User User { get; set; } = null!;

    public virtual Permission Permission { get; set; } = null!;
}

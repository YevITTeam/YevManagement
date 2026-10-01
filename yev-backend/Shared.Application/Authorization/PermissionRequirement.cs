using System.Collections.Generic;

namespace Shared.Application.Authorization
{
    // Thoả mãn nếu người dùng có BẤT KỲ 1 trong các permission liệt kê (quan hệ OR) — đa số action vẫn
    // chỉ truyền đúng 1 permission (Permissions.Count == 1, hành vi y hệt trước 2026-09-28). Mở rộng để
    // hỗ trợ case "2 quyền coi như tương đương ở cùng 1 endpoint" (vd Attendance.OTForm.Create HOẶC
    // Attendance.OTForm.CreateProduction đều gọi được POST/PUT /api/OtForm — xem OtFormController.Create,
    // action tự phân biệt lại ĐÚNG quyền theo từng chế độ đơn ở bên trong, cổng OR này chỉ để không chặn
    // nhầm người chỉ có 1 trong 2 quyền).
    public class PermissionRequirement : Microsoft.AspNetCore.Authorization.IAuthorizationRequirement
    {
        public IReadOnlyList<string> Permissions { get; }

        public PermissionRequirement(params string[] permissions)
        {
            Permissions = permissions;
        }
    }
}

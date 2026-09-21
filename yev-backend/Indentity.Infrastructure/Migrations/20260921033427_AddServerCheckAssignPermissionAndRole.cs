using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Identity.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddServerCheckAssignPermissionAndRole : Migration
    {
        /// <inheritdoc />
        // Asset.ServerCheck.Assign: Admin gán user ↔ xưởng cho kiểm tra server (asset-module.md §1.21).
        // Role "Kiểm tra Server": role dành cho người đi quét — CHỈ có Asset.ServerCheck.Scan (vào trang
        // quét + xem phiên của xưởng mình), không có View toàn bộ/Assign. Xưởng cụ thể do Admin phân công
        // riêng cho từng user, không nằm ở role.
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
INSERT INTO Permissions (Code, Module, Description)
SELECT N'Asset.ServerCheck.Assign', N'Asset', N'Phân công user phụ trách kiểm tra server cho từng xưởng'
WHERE NOT EXISTS (SELECT 1 FROM Permissions WHERE Code = N'Asset.ServerCheck.Assign');

INSERT INTO RolePermissions (RoleId, PermissionId)
SELECT r.Id, p.Id FROM Roles r CROSS JOIN Permissions p
WHERE r.RoleName = N'Admin' AND r.IsDeleted = 0 AND p.Code = N'Asset.ServerCheck.Assign'
  AND NOT EXISTS (SELECT 1 FROM RolePermissions rp WHERE rp.RoleId = r.Id AND rp.PermissionId = p.Id);

INSERT INTO Roles (RoleName, Description, IsDeleted)
SELECT N'Kiểm tra Server', N'Người đi quét QR kiểm tra server hằng ngày — chỉ được vào phần Kiểm tra Server, xưởng phụ trách do Admin phân công (docs/asset-module.md §1.21).', 0
WHERE NOT EXISTS (SELECT 1 FROM Roles WHERE RoleName = N'Kiểm tra Server');

INSERT INTO RolePermissions (RoleId, PermissionId)
SELECT r.Id, p.Id FROM Roles r CROSS JOIN Permissions p
WHERE r.RoleName = N'Kiểm tra Server' AND r.IsDeleted = 0 AND p.Code = N'Asset.ServerCheck.Scan'
  AND NOT EXISTS (SELECT 1 FROM RolePermissions rp WHERE rp.RoleId = r.Id AND rp.PermissionId = p.Id);
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
DELETE FROM UserRoles WHERE RoleId IN (SELECT Id FROM Roles WHERE RoleName = N'Kiểm tra Server');
DELETE FROM RolePermissions WHERE RoleId IN (SELECT Id FROM Roles WHERE RoleName = N'Kiểm tra Server');
DELETE FROM Roles WHERE RoleName = N'Kiểm tra Server';
DELETE FROM RolePermissions WHERE PermissionId IN (SELECT Id FROM Permissions WHERE Code = N'Asset.ServerCheck.Assign');
DELETE FROM Permissions WHERE Code = N'Asset.ServerCheck.Assign';
");
        }
    }
}

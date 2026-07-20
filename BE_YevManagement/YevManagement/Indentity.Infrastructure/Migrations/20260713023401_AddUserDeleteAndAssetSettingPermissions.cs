using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Identity.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddUserDeleteAndAssetSettingPermissions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Identity.User.Delete: hard-delete a User (see docs/identity-module.md).
            // Asset.Setting.View/Update: view/edit the number-of-months configuration for "Pending Liquidation
            // -> Liquidated" used by DeviceLiquidationBackgroundService (see docs/asset-module.md).
            migrationBuilder.Sql(@"
INSERT INTO Permissions (Code, Module, Description) VALUES
(N'Identity.User.Delete', N'Identity', N'Xóa cứng người dùng'),
(N'Asset.Setting.View', N'Asset', N'Xem cấu hình hệ thống Asset'),
(N'Asset.Setting.Update', N'Asset', N'Sửa cấu hình hệ thống Asset');

-- Gán permission mới cho role Admin hiện có, cùng lý do với migration seed permission ban đầu.
INSERT INTO RolePermissions (RoleId, PermissionId)
SELECT r.Id, p.Id FROM Roles r CROSS JOIN Permissions p
WHERE r.RoleName = N'Admin' AND r.IsDeleted = 0
  AND p.Code IN (N'Identity.User.Delete', N'Asset.Setting.View', N'Asset.Setting.Update');
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
DELETE FROM RolePermissions WHERE PermissionId IN (
    SELECT Id FROM Permissions WHERE Code IN (
        N'Identity.User.Delete', N'Asset.Setting.View', N'Asset.Setting.Update'));
DELETE FROM Permissions WHERE Code IN (
    N'Identity.User.Delete', N'Asset.Setting.View', N'Asset.Setting.Update');
");
        }
    }
}

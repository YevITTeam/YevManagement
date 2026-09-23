using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Identity.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddServerCheckPermissions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Asset.ServerCheck.Scan: thao tác trên máy quét TC21/TC22 (bắt đầu/quét QR/kết thúc phiên).
            // Asset.ServerCheck.View: xem lịch sử phiên + báo cáo tổng hợp trên web (see docs/asset-module.md).
            migrationBuilder.Sql(@"
INSERT INTO Permissions (Code, Module, Description) VALUES
(N'Asset.ServerCheck.Scan', N'Asset', N'Quét QR kiểm tra server/máy lạnh/UPS/network hằng ngày'),
(N'Asset.ServerCheck.View', N'Asset', N'Xem lịch sử và báo cáo kiểm tra server hằng ngày');

INSERT INTO RolePermissions (RoleId, PermissionId)
SELECT r.Id, p.Id FROM Roles r CROSS JOIN Permissions p
WHERE r.RoleName = N'Admin' AND r.IsDeleted = 0
  AND p.Code IN (N'Asset.ServerCheck.Scan', N'Asset.ServerCheck.View');
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
DELETE FROM RolePermissions WHERE PermissionId IN (
    SELECT Id FROM Permissions WHERE Code IN (
        N'Asset.ServerCheck.Scan', N'Asset.ServerCheck.View'));
DELETE FROM Permissions WHERE Code IN (
    N'Asset.ServerCheck.Scan', N'Asset.ServerCheck.View');
");
        }
    }
}

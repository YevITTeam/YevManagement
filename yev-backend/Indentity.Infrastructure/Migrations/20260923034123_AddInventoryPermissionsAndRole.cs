using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Identity.Infrastructure.Migrations
{
    /// <inheritdoc />
    // Asset.Inventory.Scan: thao tác trên màn quét kiểm kê (bắt đầu/quét mã/kết thúc phiên).
    // Asset.Inventory.View: xem lịch sử phiên + báo cáo kiểm kê trên web.
    // Asset.Inventory.Assign: Admin gán user ↔ xưởng cho kiểm kê (asset-module.md §1.22).
    // Role "Kiểm kê thiết bị": role dành cho người đi quét — CHỈ có Asset.Inventory.Scan, xưởng cụ thể
    // do Admin phân công riêng cho từng user (không nằm ở role) — cùng pattern role "Kiểm tra Server".
    public partial class AddInventoryPermissionsAndRole : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
INSERT INTO Permissions (Code, Module, Description)
SELECT code, N'Asset', description FROM (VALUES
    (N'Asset.Inventory.Scan', N'Quét mã kiểm kê thiết bị theo xưởng'),
    (N'Asset.Inventory.View', N'Xem lịch sử và báo cáo kiểm kê thiết bị'),
    (N'Asset.Inventory.Assign', N'Phân công user phụ trách kiểm kê thiết bị cho từng xưởng')
) AS v(code, description)
WHERE NOT EXISTS (SELECT 1 FROM Permissions WHERE Code = v.code);

INSERT INTO RolePermissions (RoleId, PermissionId)
SELECT r.Id, p.Id FROM Roles r CROSS JOIN Permissions p
WHERE r.RoleName = N'Admin' AND r.IsDeleted = 0
  AND p.Code IN (N'Asset.Inventory.Scan', N'Asset.Inventory.View', N'Asset.Inventory.Assign')
  AND NOT EXISTS (SELECT 1 FROM RolePermissions rp WHERE rp.RoleId = r.Id AND rp.PermissionId = p.Id);

INSERT INTO Roles (RoleName, Description, IsDeleted)
SELECT N'Kiểm kê thiết bị', N'Người đi quét mã kiểm kê thiết bị — chỉ được vào phần Kiểm kê thiết bị, xưởng phụ trách do Admin phân công (docs/asset-module.md §1.22).', 0
WHERE NOT EXISTS (SELECT 1 FROM Roles WHERE RoleName = N'Kiểm kê thiết bị');

INSERT INTO RolePermissions (RoleId, PermissionId)
SELECT r.Id, p.Id FROM Roles r CROSS JOIN Permissions p
WHERE r.RoleName = N'Kiểm kê thiết bị' AND r.IsDeleted = 0 AND p.Code = N'Asset.Inventory.Scan'
  AND NOT EXISTS (SELECT 1 FROM RolePermissions rp WHERE rp.RoleId = r.Id AND rp.PermissionId = p.Id);
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
DELETE FROM UserRoles WHERE RoleId IN (SELECT Id FROM Roles WHERE RoleName = N'Kiểm kê thiết bị');
DELETE FROM RolePermissions WHERE RoleId IN (SELECT Id FROM Roles WHERE RoleName = N'Kiểm kê thiết bị');
DELETE FROM Roles WHERE RoleName = N'Kiểm kê thiết bị';
DELETE FROM RolePermissions WHERE PermissionId IN (
    SELECT Id FROM Permissions WHERE Code IN (
        N'Asset.Inventory.Scan', N'Asset.Inventory.View', N'Asset.Inventory.Assign'));
DELETE FROM Permissions WHERE Code IN (
    N'Asset.Inventory.Scan', N'Asset.Inventory.View', N'Asset.Inventory.Assign');
");
        }
    }
}

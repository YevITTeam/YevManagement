using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Identity.Infrastructure.Migrations
{
    /// <inheritdoc />
    // Asset.AppRelease.Manage: CRUD bản phát hành app Flutter "YEV Scan" (asset-module.md §1.23) — 1
    // permission duy nhất cho grid-list/create/update/delete (không tách View/Create/Update/Delete như
    // Branch, quyết định người dùng). Endpoint GET /latest là [AllowAnonymous], không cần permission.
    public partial class AddAppReleaseManagePermission : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
INSERT INTO Permissions (Code, Module, Description)
SELECT N'Asset.AppRelease.Manage', N'Asset', N'Quản lý bản cập nhật app YEV Scan'
WHERE NOT EXISTS (SELECT 1 FROM Permissions WHERE Code = N'Asset.AppRelease.Manage');

INSERT INTO RolePermissions (RoleId, PermissionId)
SELECT r.Id, p.Id FROM Roles r CROSS JOIN Permissions p
WHERE r.RoleName = N'Admin' AND r.IsDeleted = 0 AND p.Code = N'Asset.AppRelease.Manage'
  AND NOT EXISTS (SELECT 1 FROM RolePermissions rp WHERE rp.RoleId = r.Id AND rp.PermissionId = p.Id);
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
DELETE FROM RolePermissions WHERE PermissionId IN (
    SELECT Id FROM Permissions WHERE Code = N'Asset.AppRelease.Manage');
DELETE FROM Permissions WHERE Code = N'Asset.AppRelease.Manage';
");
        }
    }
}

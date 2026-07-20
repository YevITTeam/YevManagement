using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Identity.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddAssetAuditTrailPermission : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Asset.AuditTrail.View: view the Create/Update/Delete history (who/when/what changed) of
            // the Asset module — recorded automatically via AssetDbContext.SaveChangesAsync (see docs/asset-module.md).
            migrationBuilder.Sql(@"
INSERT INTO Permissions (Code, Module, Description) VALUES
(N'Asset.AuditTrail.View', N'Asset', N'Xem lịch sử thay đổi (audit trail) dữ liệu Asset');

-- Gán permission mới cho role Admin hiện có, cùng lý do với migration seed permission ban đầu.
INSERT INTO RolePermissions (RoleId, PermissionId)
SELECT r.Id, p.Id FROM Roles r CROSS JOIN Permissions p
WHERE r.RoleName = N'Admin' AND r.IsDeleted = 0
  AND p.Code = N'Asset.AuditTrail.View';
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
DELETE FROM RolePermissions WHERE PermissionId IN (
    SELECT Id FROM Permissions WHERE Code = N'Asset.AuditTrail.View');
DELETE FROM Permissions WHERE Code = N'Asset.AuditTrail.View';
");
        }
    }
}

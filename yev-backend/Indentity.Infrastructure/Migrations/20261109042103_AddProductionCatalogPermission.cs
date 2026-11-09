using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Identity.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddProductionCatalogPermission : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Admin only: a wrong catalog change makes every import row using that code fail.
            migrationBuilder.Sql(@"
INSERT INTO Permissions (Code, Module, Description)
SELECT N'Attendance.ProductionCatalog.Manage', N'Attendance', N'Quản lý danh mục Line, Team, Nhóm ca'
WHERE NOT EXISTS (SELECT 1 FROM Permissions p WHERE p.Code = N'Attendance.ProductionCatalog.Manage');

INSERT INTO RolePermissions (RoleId, PermissionId)
SELECT r.Id, p.Id FROM Roles r CROSS JOIN Permissions p
WHERE r.RoleName = N'Admin' AND r.IsDeleted = 0 AND p.Code = N'Attendance.ProductionCatalog.Manage'
  AND NOT EXISTS (SELECT 1 FROM RolePermissions x WHERE x.RoleId = r.Id AND x.PermissionId = p.Id);
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
DELETE FROM RolePermissions WHERE PermissionId IN (
    SELECT Id FROM Permissions WHERE Code = N'Attendance.ProductionCatalog.Manage');
DELETE FROM UserPermissions WHERE PermissionId IN (
    SELECT Id FROM Permissions WHERE Code = N'Attendance.ProductionCatalog.Manage');
DELETE FROM Permissions WHERE Code = N'Attendance.ProductionCatalog.Manage';
");
        }
    }
}

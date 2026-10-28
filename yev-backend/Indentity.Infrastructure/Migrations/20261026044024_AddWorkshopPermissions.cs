using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Identity.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddWorkshopPermissions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Workshop catalog: View goes to every role that can already view Groups (the Group form needs the
            // workshop list); Create/Update/Delete go to Admin and the roles that can already create Departments.
            migrationBuilder.Sql(@"
INSERT INTO Permissions (Code, Module, Description)
SELECT v.Code, N'Attendance', v.Description FROM (VALUES
(N'Attendance.Workshop.View', N'Xem danh sách / chi tiết xưởng'),
(N'Attendance.Workshop.Create', N'Thêm xưởng'),
(N'Attendance.Workshop.Update', N'Sửa xưởng'),
(N'Attendance.Workshop.Delete', N'Xóa xưởng')) AS v(Code, Description)
WHERE NOT EXISTS (SELECT 1 FROM Permissions p WHERE p.Code = v.Code);

INSERT INTO RolePermissions (RoleId, PermissionId)
SELECT DISTINCT rp.RoleId, p.Id
FROM RolePermissions rp
INNER JOIN Permissions src ON src.Id = rp.PermissionId AND src.Code = N'Attendance.Group.View'
CROSS JOIN Permissions p
WHERE p.Code = N'Attendance.Workshop.View'
  AND NOT EXISTS (SELECT 1 FROM RolePermissions x WHERE x.RoleId = rp.RoleId AND x.PermissionId = p.Id);

INSERT INTO RolePermissions (RoleId, PermissionId)
SELECT DISTINCT rp.RoleId, p.Id
FROM RolePermissions rp
INNER JOIN Permissions src ON src.Id = rp.PermissionId AND src.Code = N'Attendance.Department.Create'
CROSS JOIN Permissions p
WHERE p.Code IN (N'Attendance.Workshop.Create', N'Attendance.Workshop.Update', N'Attendance.Workshop.Delete')
  AND NOT EXISTS (SELECT 1 FROM RolePermissions x WHERE x.RoleId = rp.RoleId AND x.PermissionId = p.Id);

INSERT INTO RolePermissions (RoleId, PermissionId)
SELECT r.Id, p.Id FROM Roles r CROSS JOIN Permissions p
WHERE r.RoleName = N'Admin' AND r.IsDeleted = 0 AND p.Code LIKE N'Attendance.Workshop.%'
  AND NOT EXISTS (SELECT 1 FROM RolePermissions x WHERE x.RoleId = r.Id AND x.PermissionId = p.Id);
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
DELETE FROM RolePermissions WHERE PermissionId IN (
    SELECT Id FROM Permissions WHERE Code LIKE N'Attendance.Workshop.%');
DELETE FROM UserPermissions WHERE PermissionId IN (
    SELECT Id FROM Permissions WHERE Code LIKE N'Attendance.Workshop.%');
DELETE FROM Permissions WHERE Code LIKE N'Attendance.Workshop.%';
");
        }
    }
}

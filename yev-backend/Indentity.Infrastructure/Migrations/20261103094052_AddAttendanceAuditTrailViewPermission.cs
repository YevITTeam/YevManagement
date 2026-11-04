using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Identity.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddAttendanceAuditTrailViewPermission : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
INSERT INTO Permissions (Code, Module, Description)
SELECT N'Attendance.AuditTrail.View', N'Attendance', N'Xem nhật ký thao tác và nhật ký email OT'
WHERE NOT EXISTS (SELECT 1 FROM Permissions WHERE Code = N'Attendance.AuditTrail.View');

INSERT INTO RolePermissions (RoleId, PermissionId)
SELECT r.Id, p.Id FROM Roles r CROSS JOIN Permissions p
WHERE r.RoleName = N'Admin' AND r.IsDeleted = 0 AND p.Code = N'Attendance.AuditTrail.View'
  AND NOT EXISTS (SELECT 1 FROM RolePermissions rp WHERE rp.RoleId = r.Id AND rp.PermissionId = p.Id);
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
DELETE FROM RolePermissions WHERE PermissionId IN (
    SELECT Id FROM Permissions WHERE Code = N'Attendance.AuditTrail.View');
DELETE FROM Permissions WHERE Code = N'Attendance.AuditTrail.View';
");
        }
    }
}

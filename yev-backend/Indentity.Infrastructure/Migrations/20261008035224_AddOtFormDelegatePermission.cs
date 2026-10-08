using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Identity.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddOtFormDelegatePermission : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Attendance.OTForm.Delegate: may create approval delegations; granted per Job Title through
            // JobTitlePermission, Admin gets it by default.
            migrationBuilder.Sql(@"
INSERT INTO Permissions (Code, Module, Description)
SELECT N'Attendance.OTForm.Delegate', N'Attendance', N'Ủy quyền duyệt đơn tăng ca cho người khác'
WHERE NOT EXISTS (SELECT 1 FROM Permissions WHERE Code = N'Attendance.OTForm.Delegate');

INSERT INTO RolePermissions (RoleId, PermissionId)
SELECT r.Id, p.Id FROM Roles r CROSS JOIN Permissions p
WHERE r.RoleName = N'Admin' AND r.IsDeleted = 0 AND p.Code = N'Attendance.OTForm.Delegate'
  AND NOT EXISTS (SELECT 1 FROM RolePermissions rp WHERE rp.RoleId = r.Id AND rp.PermissionId = p.Id);
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
DELETE FROM RolePermissions WHERE PermissionId IN (
    SELECT Id FROM Permissions WHERE Code = N'Attendance.OTForm.Delegate');
DELETE FROM UserPermissions WHERE PermissionId IN (
    SELECT Id FROM Permissions WHERE Code = N'Attendance.OTForm.Delegate');
DELETE FROM Permissions WHERE Code = N'Attendance.OTForm.Delegate';
");
        }
    }
}

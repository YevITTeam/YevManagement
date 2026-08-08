using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Identity.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddOtFormDeletePermission : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Attendance.OTForm.Delete: Admin xoá đơn kẹt vĩnh viễn trong chuỗi duyệt (thiếu candidate ở
            // 1 bước, không resolve lại được — POST /api/OtForm/{id}/delete), xem
            // docs/docs-be/attendance-module.md §Cây chức vụ (2026-08-08). Cố tình CHỈ gán cho Admin
            // (piggyback trên Attendance.Department.Create, cùng cách làm với AddAttendanceSettingPermission)
            // — không role nghiệp vụ nào (kể cả TGĐ) được xoá đơn, chỉ Admin.
            migrationBuilder.Sql(@"
INSERT INTO Permissions (Code, Module, Description) VALUES
(N'Attendance.OTForm.Delete', N'Attendance', N'Xoá đơn tăng ca kẹt vĩnh viễn trong chuỗi duyệt (Admin)');

INSERT INTO RolePermissions (RoleId, PermissionId)
SELECT rp.RoleId, p.Id
FROM RolePermissions rp
INNER JOIN Permissions dp ON dp.Id = rp.PermissionId AND dp.Code = N'Attendance.Department.Create'
CROSS JOIN Permissions p
WHERE p.Code = N'Attendance.OTForm.Delete';
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
DELETE FROM RolePermissions WHERE PermissionId IN (
    SELECT Id FROM Permissions WHERE Code = N'Attendance.OTForm.Delete');
DELETE FROM Permissions WHERE Code = N'Attendance.OTForm.Delete';
");
        }
    }
}

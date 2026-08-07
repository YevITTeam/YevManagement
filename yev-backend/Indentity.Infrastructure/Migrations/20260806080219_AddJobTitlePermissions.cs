using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Identity.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddJobTitlePermissions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Attendance.JobTitle.*: quản lý danh mục Chức vụ (cây chức vụ dùng suy luận chuỗi duyệt
            // OT tự động) — xem docs/docs-be/attendance-module.md §Cây chức vụ. Gán cho đúng các Role
            // đang giữ Attendance.Department.Create (nhóm CRUD Danh mục, thực tế chỉ Admin), cùng cách
            // làm với AddAttendanceSettingPermission/AddOtFormRemoveEmployeePermission.
            migrationBuilder.Sql(@"
INSERT INTO Permissions (Code, Module, Description) VALUES
(N'Attendance.JobTitle.View', N'Attendance', N'Xem danh mục Chức vụ'),
(N'Attendance.JobTitle.Create', N'Attendance', N'Thêm Chức vụ'),
(N'Attendance.JobTitle.Update', N'Attendance', N'Sửa Chức vụ'),
(N'Attendance.JobTitle.Delete', N'Attendance', N'Xóa Chức vụ');

INSERT INTO RolePermissions (RoleId, PermissionId)
SELECT rp.RoleId, p.Id
FROM RolePermissions rp
INNER JOIN Permissions dp ON dp.Id = rp.PermissionId AND dp.Code = N'Attendance.Department.Create'
CROSS JOIN Permissions p
WHERE p.Code IN (N'Attendance.JobTitle.View', N'Attendance.JobTitle.Create', N'Attendance.JobTitle.Update', N'Attendance.JobTitle.Delete');
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
DELETE FROM RolePermissions WHERE PermissionId IN (
    SELECT Id FROM Permissions WHERE Code IN (
        N'Attendance.JobTitle.View', N'Attendance.JobTitle.Create', N'Attendance.JobTitle.Update', N'Attendance.JobTitle.Delete'));
DELETE FROM Permissions WHERE Code IN (
    N'Attendance.JobTitle.View', N'Attendance.JobTitle.Create', N'Attendance.JobTitle.Update', N'Attendance.JobTitle.Delete');
");
        }
    }
}

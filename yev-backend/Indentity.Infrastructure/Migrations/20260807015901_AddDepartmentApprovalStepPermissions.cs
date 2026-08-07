using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Identity.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddDepartmentApprovalStepPermissions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Attendance.DepartmentApprovalStep.*: cấu hình tay cây duyệt (danh sách Chức vụ theo thứ
            // tự) cho từng Phòng ban — xem docs/docs-be/attendance-module.md §Cây chức vụ. Gán cho đúng
            // các Role đang giữ Attendance.Department.Create (nhóm CRUD Danh mục, thực tế chỉ Admin),
            // cùng cách làm với AddJobTitlePermissions/AddAttendanceSettingPermission.
            migrationBuilder.Sql(@"
INSERT INTO Permissions (Code, Module, Description) VALUES
(N'Attendance.DepartmentApprovalStep.View', N'Attendance', N'Xem cây duyệt của Phòng ban'),
(N'Attendance.DepartmentApprovalStep.Update', N'Attendance', N'Cấu hình cây duyệt của Phòng ban');

INSERT INTO RolePermissions (RoleId, PermissionId)
SELECT rp.RoleId, p.Id
FROM RolePermissions rp
INNER JOIN Permissions dp ON dp.Id = rp.PermissionId AND dp.Code = N'Attendance.Department.Create'
CROSS JOIN Permissions p
WHERE p.Code IN (N'Attendance.DepartmentApprovalStep.View', N'Attendance.DepartmentApprovalStep.Update');
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
DELETE FROM RolePermissions WHERE PermissionId IN (
    SELECT Id FROM Permissions WHERE Code IN (
        N'Attendance.DepartmentApprovalStep.View', N'Attendance.DepartmentApprovalStep.Update'));
DELETE FROM Permissions WHERE Code IN (
    N'Attendance.DepartmentApprovalStep.View', N'Attendance.DepartmentApprovalStep.Update');
");
        }
    }
}

using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Identity.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddOtFormAddEmployeePermission : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Attendance.OTForm.AddEmployee: thêm 1 nhân viên vào đơn khi ký/duyệt (chiều ngược của
            // Attendance.OTForm.RemoveEmployee, POST /api/OtForm/{id}/employees/add, 2026-08-28 theo
            // yêu cầu người dùng — xem docs/docs-be/attendance-module.md). Gán cho ĐÚNG các Role đang
            // giữ Attendance.OTForm.RemoveEmployee bằng subquery (mirror migration
            // AddOtFormRemoveEmployeePermission) thay vì liệt kê tên Role — tự động khớp nếu danh sách
            // Role đó đổi sau này.
            migrationBuilder.Sql(@"
INSERT INTO Permissions (Code, Module, Description) VALUES
(N'Attendance.OTForm.AddEmployee', N'Attendance', N'Thêm 1 nhân viên vào đơn tăng ca khi ký/duyệt');

INSERT INTO RolePermissions (RoleId, PermissionId)
SELECT rp.RoleId, p.Id
FROM RolePermissions rp
INNER JOIN Permissions up ON up.Id = rp.PermissionId AND up.Code = N'Attendance.OTForm.RemoveEmployee'
CROSS JOIN Permissions p
WHERE p.Code = N'Attendance.OTForm.AddEmployee';
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
DELETE FROM RolePermissions WHERE PermissionId IN (
    SELECT Id FROM Permissions WHERE Code = N'Attendance.OTForm.AddEmployee');
DELETE FROM Permissions WHERE Code = N'Attendance.OTForm.AddEmployee';
");
        }
    }
}

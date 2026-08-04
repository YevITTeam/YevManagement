using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Identity.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddAttendanceSettingPermission : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Attendance.Setting.Update: sửa cấu hình dùng chung của module Attendance (mốc giờ nhận
            // phiếu chính, giới hạn lũy kế tháng/năm) — PUT /api/AttendanceSetting, xem
            // docs/docs-be/attendance-module.md §Cấu hình phiếu ăn & giới hạn lũy kế.
            //
            // CHỈ seed permission cho hành động SỬA. Hành động XEM (GET /api/AttendanceSetting) cố tình
            // KHÔNG gắn permission — mọi tài khoản đăng nhập đều phải đọc được cấu hình này thì màn Tạo
            // đơn mới tự tính được phiếu ăn và tô đỏ được lũy kế vượt ngưỡng (Trưởng nhóm/Nhân viên
            // không hề có permission quản trị nào).
            //
            // Gán cho đúng các Role đang giữ Attendance.Department.Create — tức nhóm Role được CRUD
            // Danh mục (thực tế chỉ Admin) — bằng subquery thay vì liệt kê tên Role, cùng cách làm với
            // AddSecondaryPasswordPermission/AddOtFormRemoveEmployeePermission.
            migrationBuilder.Sql(@"
INSERT INTO Permissions (Code, Module, Description) VALUES
(N'Attendance.Setting.Update', N'Attendance', N'Sửa cấu hình chấm công (mốc giờ nhận phiếu ăn, giới hạn lũy kế tháng/năm)');

INSERT INTO RolePermissions (RoleId, PermissionId)
SELECT rp.RoleId, p.Id
FROM RolePermissions rp
INNER JOIN Permissions dp ON dp.Id = rp.PermissionId AND dp.Code = N'Attendance.Department.Create'
CROSS JOIN Permissions p
WHERE p.Code = N'Attendance.Setting.Update';
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
DELETE FROM RolePermissions WHERE PermissionId IN (
    SELECT Id FROM Permissions WHERE Code = N'Attendance.Setting.Update');
DELETE FROM Permissions WHERE Code = N'Attendance.Setting.Update';
");
        }
    }
}

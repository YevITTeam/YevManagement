using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Identity.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddSecondaryPasswordPermission : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Attendance.SecondaryPassword.Update: tự đăng ký/cập nhật mật khẩu cấp 2 của chính mình
            // (GET/PUT /api/SecondaryPassword/me) — mật khẩu này được yêu cầu nhập lại ở MỌI hành động
            // ký/duyệt OtForm (submit/approve/reject, kể cả kênh email), xem
            // docs/docs-be/attendance-module.md — Mật khẩu cấp 2. Gán cho đúng các Role đang giữ
            // Attendance.UserSignature.Update (Admin + toàn bộ Role có quyền ký/duyệt đơn) bằng
            // subquery thay vì liệt kê tên Role — tự động khớp nếu sau này danh sách Role đó đổi.
            migrationBuilder.Sql(@"
INSERT INTO Permissions (Code, Module, Description) VALUES
(N'Attendance.SecondaryPassword.Update', N'Attendance', N'Tự thiết lập/cập nhật mật khẩu cấp 2 dùng khi ký duyệt đơn tăng ca');

INSERT INTO RolePermissions (RoleId, PermissionId)
SELECT rp.RoleId, p.Id
FROM RolePermissions rp
INNER JOIN Permissions up ON up.Id = rp.PermissionId AND up.Code = N'Attendance.UserSignature.Update'
CROSS JOIN Permissions p
WHERE p.Code = N'Attendance.SecondaryPassword.Update';
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
DELETE FROM RolePermissions WHERE PermissionId IN (
    SELECT Id FROM Permissions WHERE Code = N'Attendance.SecondaryPassword.Update');
DELETE FROM Permissions WHERE Code = N'Attendance.SecondaryPassword.Update';
");
        }
    }
}

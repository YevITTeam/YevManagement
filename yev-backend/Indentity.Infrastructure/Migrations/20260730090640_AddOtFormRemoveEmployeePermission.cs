using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Identity.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddOtFormRemoveEmployeePermission : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Attendance.OTForm.RemoveEmployee: loại 1 nhân viên khỏi đơn để duyệt được phần còn lại
            // thay vì từ chối cả đơn (POST /api/OtForm/{id}/employees/remove), xem
            // docs/docs-be/attendance-module.md — Loại nhân viên khỏi đơn. Gán cho đúng các Role đang
            // giữ Attendance.UserSignature.Update (Admin + Trưởng Group/Trưởng Bộ phận/Trưởng phòng/
            // Trưởng xưởng/Tổng Giám Đốc — tức MỌI cấp thực sự ký/duyệt đơn) bằng subquery thay vì liệt
            // kê tên Role, cùng cách làm với migration AddSecondaryPasswordPermission — tự động khớp
            // nếu danh sách Role đó đổi sau này. Role "Nhân viên" (chỉ tạo đơn, không ký/duyệt, không
            // có UserSignature.Update) cố tình KHÔNG được gán permission này.
            migrationBuilder.Sql(@"
INSERT INTO Permissions (Code, Module, Description) VALUES
(N'Attendance.OTForm.RemoveEmployee', N'Attendance', N'Loại 1 nhân viên khỏi đơn tăng ca khi ký/duyệt (thay vì từ chối cả đơn)');

INSERT INTO RolePermissions (RoleId, PermissionId)
SELECT rp.RoleId, p.Id
FROM RolePermissions rp
INNER JOIN Permissions up ON up.Id = rp.PermissionId AND up.Code = N'Attendance.UserSignature.Update'
CROSS JOIN Permissions p
WHERE p.Code = N'Attendance.OTForm.RemoveEmployee';
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
DELETE FROM RolePermissions WHERE PermissionId IN (
    SELECT Id FROM Permissions WHERE Code = N'Attendance.OTForm.RemoveEmployee');
DELETE FROM Permissions WHERE Code = N'Attendance.OTForm.RemoveEmployee';
");
        }
    }
}

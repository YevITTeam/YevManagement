using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Identity.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddAttendanceAiChatPermission : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Attendance.AiChat.Use: gọi endpoint POST /api/AttendanceAiChat/stream (trợ lý AI hỗ trợ
            // lập đơn tăng ca — Draft, qua tool-calling nội bộ, xem
            // docs/docs-be/attendance-module.md §AttendanceAiChat). Cùng pattern với migration seed
            // permission AddAssetAiChatPermission. Chỉ gán Admin ở migration đầu (giống đúng tiền lệ
            // Asset AI Chat) — gán thêm cho Role "Trưởng nhóm"/"Nhân viên" (2 role hiện có
            // Attendance.OTForm.Create) là quyết định vận hành, làm sau qua UI gán permission có sẵn
            // khi đã test ổn với Admin.
            migrationBuilder.Sql(@"
INSERT INTO Permissions (Code, Module, Description) VALUES
(N'Attendance.AiChat.Use', N'Attendance', N'Sử dụng trợ lý AI tạo đơn tăng ca (Draft)');

INSERT INTO RolePermissions (RoleId, PermissionId)
SELECT r.Id, p.Id FROM Roles r CROSS JOIN Permissions p
WHERE r.RoleName = N'Admin' AND r.IsDeleted = 0
  AND p.Code = N'Attendance.AiChat.Use';
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
DELETE FROM RolePermissions WHERE PermissionId IN (
    SELECT Id FROM Permissions WHERE Code = N'Attendance.AiChat.Use');
DELETE FROM Permissions WHERE Code = N'Attendance.AiChat.Use';
");
        }
    }
}

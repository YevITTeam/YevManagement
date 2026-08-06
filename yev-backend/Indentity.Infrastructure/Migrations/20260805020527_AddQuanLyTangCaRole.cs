using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Identity.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddQuanLyTangCaRole : Migration
    {
        /// <inheritdoc />
        // Role duy nhất cho toàn bộ chuỗi duyệt OT (2026-08-05, xem docs/attendance-module.md và
        // ~/.claude/plans/attendance-single-role-permission-refactor.md) — thay cho việc mỗi cấp duyệt
        // mới lại phải sinh 1 Role riêng ở Identity (vd Trưởng nhóm/Trưởng Bộ phận/Trưởng phòng/Trưởng
        // xưởng/Tổng Giám Đốc, xem migration AddGroupHeadRole). CHỦ ĐÍCH seed KHÔNG kèm permission nào
        // (khác AddGroupHeadRole) — Admin tự cấp permission theo từng người qua "Quản lý người dùng >
        // Tuỳ chỉnh quyền" (UserPermissionOverride), không hardcode 1 bộ quyền cố định cho Role này.
        // 5 Role legacy (Trưởng nhóm/Trưởng Bộ phận/Trưởng phòng/Trưởng xưởng/Tổng Giám Đốc) GIỮ NGUYÊN,
        // không xoá — người đang giữ vẫn chạy bình thường, chỉ không gán Role đó cho người mới nữa.
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
INSERT INTO Roles (RoleName, Description, IsDeleted) VALUES
(N'Quản lý tăng ca', N'Role duy nhất cho người tham gia quy trình duyệt tăng ca (lập đơn/ký/duyệt/quản trị) — Admin tự cấp permission cụ thể theo từng người qua Tuỳ chỉnh quyền, xem docs/attendance-module.md.', 0);
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
DELETE FROM UserRoles WHERE RoleId IN (
    SELECT Id FROM Roles WHERE RoleName = N'Quản lý tăng ca');
DELETE FROM Roles WHERE RoleName = N'Quản lý tăng ca';
");
        }
    }
}

using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Identity.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class RenameTruongGroupToTruongNhom : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Đổi tên hiển thị Role "Trưởng Group" -> "Trưởng nhóm" cho khớp cách gọi thực tế
            // (Group = Bộ phận, người ký cấp Submitter ngoài đời gọi là "Trưởng nhóm"). Chỉ đổi
            // RoleName, giữ nguyên Id/RolePermissions/UserRoles đã gán — không ảnh hưởng phân quyền.
            migrationBuilder.Sql(@"
UPDATE Roles SET RoleName = N'Trưởng nhóm'
WHERE RoleName = N'Trưởng Group' AND IsDeleted = 0;
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
UPDATE Roles SET RoleName = N'Trưởng Group'
WHERE RoleName = N'Trưởng nhóm' AND IsDeleted = 0;
");
        }
    }
}

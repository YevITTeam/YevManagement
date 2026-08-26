using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Workflow.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddJobTitleIsUniquePerOrgUnit : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // defaultValue: true — giữ nguyên hành vi CŨ (đơn/vị/chức danh chỉ 1 người) cho MỌI chức
            // danh có sẵn trong DB, tránh âm thầm làm luồng duyệt theo JobTitle (đã cấu hình từ trước)
            // trở nên không xác định. Admin tự bật false cho từng chức danh phổ thông (vd "Nhân viên")
            // qua màn quản lý Chức danh sau khi migrate.
            migrationBuilder.AddColumn<bool>(
                name: "IsUniquePerOrgUnit",
                table: "JobTitles",
                type: "bit",
                nullable: false,
                defaultValue: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "IsUniquePerOrgUnit",
                table: "JobTitles");
        }
    }
}

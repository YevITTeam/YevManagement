using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Yev.Repositories.Migrations
{
    /// <inheritdoc />
    public partial class RenameChagedAtColumn : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Ép EF Core chạy lệnh đổi tên cột thay vì tạo bảng
            migrationBuilder.RenameColumn(
                name: "ChagedAt",
                table: "AuditTrails",
                newName: "ChangedAt");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Lệnh hoàn tác nếu bạn muốn lùi Migration
            migrationBuilder.RenameColumn(
                name: "ChangedAt",
                table: "AuditTrails",
                newName: "ChagedAt");
        }
    }
}

using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Attendance.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddJobTitle : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "JobTitleId",
                table: "Employees",
                type: "int",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "JobTitles",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Code = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    Name = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false),
                    RankOrder = table.Column<int>(type: "int", nullable: false),
                    RequiresSignature = table.Column<bool>(type: "bit", nullable: false),
                    TerminalLevel = table.Column<int>(type: "int", nullable: false),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_JobTitles", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Employees_JobTitleId",
                table: "Employees",
                column: "JobTitleId");

            migrationBuilder.CreateIndex(
                name: "IX_JobTitles_Code",
                table: "JobTitles",
                column: "Code",
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_Employees_JobTitles_JobTitleId",
                table: "Employees",
                column: "JobTitleId",
                principalTable: "JobTitles",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            // Seed 14 chức vụ theo bảng "Chức vụ" người dùng cung cấp (docs/docs-be/attendance-module.md
            // §Cây chức vụ). Id gốc 15 (Senior Manager) trùng mã "SM" với Id gốc 12 (Section Manager) —
            // lỗi nhập liệu đã xác nhận với người dùng, đổi mã seed thành "SRM". RequiresSignature=true
            // chỉ cho 3 cấp cuối (M/FM/GM, tương ứng Trưởng phòng/Trưởng Xưởng/TGĐ, khớp cơ chế chữ ký
            // hiện có) — Admin tự chỉnh lại qua màn quản lý Chức vụ nếu cần.
            migrationBuilder.InsertData(
                table: "JobTitles",
                columns: new[] { "Code", "Name", "RankOrder", "RequiresSignature", "TerminalLevel", "IsDeleted" },
                values: new object[,]
                {
                    { "OP", "Operator", 1, false, 0, false },
                    { "STAFF", "Staff", 2, false, 0, false },
                    { "AJS", "Assistant Junior Supervisor", 3, false, 0, false },
                    { "JS", "Junior Supervisor", 4, false, 0, false },
                    { "SUP", "Supervisor", 5, false, 0, false },
                    { "ACHIEF", "Assistant Chief", 6, false, 0, false },
                    { "CHIEF", "Chief", 7, false, 0, false },
                    { "ASM", "Assistant Section Manager", 8, false, 0, false },
                    { "SM", "Section Manager", 9, false, 0, false },
                    { "ADM", "Assistant Department Manager", 10, false, 0, false },
                    { "M", "Manager", 11, true, 1, false },
                    { "SRM", "Senior Manager", 12, false, 0, false },
                    { "FM", "Factory Manager", 13, true, 2, false },
                    { "GM", "General Director", 14, true, 3, false }
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("DELETE FROM JobTitles WHERE Code IN ('OP','STAFF','AJS','JS','SUP','ACHIEF','CHIEF','ASM','SM','ADM','M','SRM','FM','GM');");

            migrationBuilder.DropForeignKey(
                name: "FK_Employees_JobTitles_JobTitleId",
                table: "Employees");

            migrationBuilder.DropTable(
                name: "JobTitles");

            migrationBuilder.DropIndex(
                name: "IX_Employees_JobTitleId",
                table: "Employees");

            migrationBuilder.DropColumn(
                name: "JobTitleId",
                table: "Employees");
        }
    }
}

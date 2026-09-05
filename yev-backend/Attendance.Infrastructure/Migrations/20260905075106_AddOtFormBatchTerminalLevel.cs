using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Attendance.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddOtFormBatchTerminalLevel : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<int>(
                name: "DepartmentId",
                table: "OtFormBatches",
                type: "int",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "int");

            // defaultValue: 1 = JobTitleTerminalLevel.DepartmentManager — mọi OtFormBatch tạo TRƯỚC
            // migration này đều là batch Trưởng phòng (tính năng company-wide WorkshopManager/
            // GeneralDirector mới thêm ở migration này), nên backfill đúng giá trị đó thay vì 0 (None).
            migrationBuilder.AddColumn<int>(
                name: "TerminalLevel",
                table: "OtFormBatches",
                type: "int",
                nullable: false,
                defaultValue: 1);

            migrationBuilder.CreateIndex(
                name: "IX_OtFormBatches_TerminalLevel",
                table: "OtFormBatches",
                column: "TerminalLevel");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_OtFormBatches_TerminalLevel",
                table: "OtFormBatches");

            migrationBuilder.DropColumn(
                name: "TerminalLevel",
                table: "OtFormBatches");

            migrationBuilder.AlterColumn<int>(
                name: "DepartmentId",
                table: "OtFormBatches",
                type: "int",
                nullable: false,
                defaultValue: 0,
                oldClrType: typeof(int),
                oldType: "int",
                oldNullable: true);
        }
    }
}

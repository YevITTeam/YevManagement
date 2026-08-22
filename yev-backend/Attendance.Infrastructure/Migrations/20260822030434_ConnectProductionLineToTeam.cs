using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Attendance.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class ConnectProductionLineToTeam : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Kết nối quan hệ Team <-> Line thật (FK) theo yêu cầu 2026-08-21 — CongDoan
            // vẫn để nguyên dạng chuỗi thô, chưa dựng quan hệ (đợi quyết định sau).
            migrationBuilder.CreateTable(
                name: "ProductionTeams",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Code = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    NameVn = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProductionTeams", x => x.Id);
                });

            // 6 giá trị Team thô đang thấy trong ProductionLines.Team hiện tại — seed trước
            // khi backfill TeamId, để giữ nguyên đúng phân bổ Line theo Team đã import.
            migrationBuilder.InsertData(
                table: "ProductionTeams",
                columns: new[] { "Code", "NameVn", "IsDeleted" },
                values: new object[,]
                {
                    { "1", null, false },
                    { "2", null, false },
                    { "HC", null, false },
                    { "GT A", null, false },
                    { "ab", null, false },
                    { "C", null, false },
                });

            migrationBuilder.AddColumn<int>(
                name: "TeamId",
                table: "ProductionLines",
                type: "int",
                nullable: true);

            migrationBuilder.Sql(@"
UPDATE pl
SET pl.TeamId = pt.Id
FROM ProductionLines pl
JOIN ProductionTeams pt ON pt.Code = pl.Team;
");

            migrationBuilder.DropColumn(
                name: "Team",
                table: "ProductionLines");

            migrationBuilder.AlterColumn<int>(
                name: "TeamId",
                table: "ProductionLines",
                type: "int",
                nullable: false,
                oldClrType: typeof(int),
                oldType: "int",
                oldNullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_ProductionLines_TeamId",
                table: "ProductionLines",
                column: "TeamId");

            migrationBuilder.AddForeignKey(
                name: "FK_ProductionLines_ProductionTeams_TeamId",
                table: "ProductionLines",
                column: "TeamId",
                principalTable: "ProductionTeams",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ProductionLines_ProductionTeams_TeamId",
                table: "ProductionLines");

            migrationBuilder.AddColumn<string>(
                name: "Team",
                table: "ProductionLines",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.Sql(@"
UPDATE pl
SET pl.Team = pt.Code
FROM ProductionLines pl
JOIN ProductionTeams pt ON pt.Id = pl.TeamId;
");

            migrationBuilder.DropTable(
                name: "ProductionTeams");

            migrationBuilder.DropIndex(
                name: "IX_ProductionLines_TeamId",
                table: "ProductionLines");

            migrationBuilder.DropColumn(
                name: "TeamId",
                table: "ProductionLines");
        }
    }
}

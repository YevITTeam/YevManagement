using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Attendance.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class RenameProductionNhomToProductionShiftTeam : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ProductionNhoms");

            migrationBuilder.CreateTable(
                name: "ProductionShiftTeams",
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
                    table.PrimaryKey("PK_ProductionShiftTeams", x => x.Id);
                });

            // Reseed with corrected data: "L" is Blue (confirmed 2026-08-21), table renamed from
            // ProductionNhoms to the clearer ProductionShiftTeams.
            migrationBuilder.InsertData(
                table: "ProductionShiftTeams",
                columns: new[] { "Code", "NameVn", "IsDeleted" },
                values: new object[,]
                {
                    { "G", "Green", false },
                    { "O", "Orange", false },
                    { "L", "Blue", false },
                    { "HC", "Hành chính", false },
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ProductionShiftTeams");

            migrationBuilder.CreateTable(
                name: "ProductionNhoms",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false),
                    NhomCode = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    NhomNameVn = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProductionNhoms", x => x.Id);
                });
        }
    }
}

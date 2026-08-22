using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Attendance.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddProductionLineAndNhom : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ProductionLines",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    LineCode = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    Team = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    CongDoan = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProductionLines", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ProductionNhoms",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    NhomCode = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    NhomNameVn = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProductionNhoms", x => x.Id);
                });

            // Seed data 2026-08-21 from docs/Data/Thong_Tin_Line_Team.xlsx (Line/Team/CongDoan,
            // Team A/B renamed 1/2 per user request) and Le Kim Ngan's email (Nhóm G/O/L/HC).
            // Deliberately independent of Department/Group/Employee — relationship not decided yet.
            migrationBuilder.InsertData(
                table: "ProductionLines",
                columns: new[] { "LineCode", "Team", "CongDoan", "IsDeleted" },
                values: new object[,]
                {
                    { "A1", "1", "ATO", false },
                    { "B1", "2", "ATO", false },
                    { "CNM", "ab", "GT AB", false },
                    { "A10", "1", "ATO", false },
                    { "B10", "2", "ATO", false },
                    { "COTTING", "AB", "GT A", false },
                    { "A100", "1", "ATO", false },
                    { "B100", "2", "ATO", false },
                    { "KHO", "AB", "GT A", false },
                    { "A11", "1", "ATO", false },
                    { "B11", "2", "ATO", false },
                    { "COTTING-Ato", "C", "GT A", false },
                    { "A12", "1", "ATO", false },
                    { "B12", "2", "ATO", false },
                    { "COTTING-Mae", "C", "GT A", false },
                    { "A13", "1", "ATO", false },
                    { "B13", "2", "ATO", false },
                    { "IT", "GT A", "GT A", false },
                    { "A14", "1", "ATO", false },
                    { "B16", "2", "ATO", false },
                    { "KE HOACH", "GT A", "GT A", false },
                    { "A15", "1", "ATO", false },
                    { "B17", "2", "ATO", false },
                    { "KTNV", "GT A", "GT A", false },
                    { "A15-CELL", "1", "ATO", false },
                    { "B2", "2", "ATO", false },
                    { "LQC-A", "GT A", "GT A", false },
                    { "A16", "1", "ATO", false },
                    { "B20", "2", "ATO", false },
                    { "LQC-M", "GT A", "GT A", false },
                    { "A17", "1", "ATO", false },
                    { "B3", "2", "ATO", false },
                    { "MUA HANG", "GT A", "GT A", false },
                    { "A18", "1", "ATO", false },
                    { "B4", "2", "ATO", false },
                    { "QAGS", "GT A", "GT A", false },
                    { "A18-CELL", "1", "ATO", false },
                    { "B5", "2", "ATO", false },
                    { "SEPPEN", "GT A", "GT A", false },
                    { "A19", "1", "ATO", false },
                    { "B6", "2", "ATO", false },
                    { "SHIPPING", "GT A", "GT A", false },
                    { "A2", "1", "ATO", false },
                    { "B7", "2", "ATO", false },
                    { "TENAOSHI", "GT A", "GT A", false },
                    { "A3", "1", "ATO", false },
                    { "B8", "2", "ATO", false },
                    { "XNK", "GT A", "GT A", false },
                    { "A4", "1", "ATO", false },
                    { "B9", "2", "ATO", false },
                    { "CNM_M", "ab", "GT AB", false },
                    { "A5", "1", "ATO", false },
                    { "BN-B", "2", "ATO", false },
                    { "LD", "AB", "GT AB", false },
                    { "A6", "1", "ATO", false },
                    { "CAT-B", "2", "MAE", false },
                    { "TC", "ab", "GT AB", false },
                    { "A7", "1", "ATO", false },
                    { "DBB", "2", "ATO", false },
                    { "TCM", "ab", "GT AB", false },
                    { "A8", "1", "ATO", false },
                    { "DBHT-B", "2", "ATO", false },
                    { "CL", "HC", "GT AB", false },
                    { "A9", "1", "ATO", false },
                    { "DBM-B", "2", "MAE", false },
                    { "HL", "HC", "GT AB", false },
                    { "BN-A", "1", "ATO", false },
                    { "JK", "2", "Mae", false },
                    { "KSU", "HC", "GT AB", false },
                    { "C", "1", "MAE", false },
                    { "OS", "2", "MAE", false },
                    { "CNM_A", "ab", "GT B", false },
                    { "CAT-A", "1", "MAE", false },
                    { "R", "2", "MAE", false },
                    { "4S", "HC", "GT B", false },
                    { "DBA", "1", "ATO", false },
                    { "TCB", "2", "GT AB", false },
                    { "CT", "HC", "GT B", false },
                    { "DBHT-A", "1", "ATO", false },
                    { "V", "2", "MAE", false },
                    { "CTCD", "HC", "GT B", false },
                    { "DBHT-A1", "1", "ATO", false },
                    { "KANBAN", "HC", "GT B", false },
                    { "DBHT-A2", "1", "ATO", false },
                    { "KANBAN-MAE", "HC", "GT B", false },
                    { "DBHT-S", "1", "ATO", false },
                    { "KZ-A", "HC", "GT B", false },
                    { "DBM-A", "1", "MAE", false },
                    { "KZ-B", "HC", "GT B", false },
                    { "E", "1", "MAE", false },
                    { "KZ-M", "HC", "GT B", false },
                    { "F", "1", "MAE", false },
                    { "MAU", "HC", "GT B", false },
                    { "TCA", "1", "GT AB", false },
                    { "MAU-HC", "HC", "GT B", false },
                    { "TKS", "1", "MAE", false },
                    { "QA", "HC", "GT B", false },
                    { "SHIDO", "HC", "GT B", false },
                    { "TQM", "HC", "GT B", false },
                    { "HL1", "C", "Mae", false },
                });

            migrationBuilder.InsertData(
                table: "ProductionNhoms",
                columns: new[] { "NhomCode", "NhomNameVn", "IsDeleted" },
                values: new object[,]
                {
                    { "G", "Green", false },
                    { "O", "Orange", false },
                    { "L", null, false },
                    { "HC", "Hành chính", false },
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ProductionLines");

            migrationBuilder.DropTable(
                name: "ProductionNhoms");
        }
    }
}

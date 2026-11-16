using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Attendance.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class GroupLineAndShift : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "ProductionLineId",
                table: "Groups",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ShiftTeamId",
                table: "Groups",
                type: "int",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Groups_LineShift",
                table: "Groups",
                columns: new[] { "ProductionLineId", "ShiftTeamId" },
                unique: true,
                filter: "[ProductionLineId] IS NOT NULL AND [IsDeleted] = 0");

            migrationBuilder.CreateIndex(
                name: "IX_Groups_ShiftTeamId",
                table: "Groups",
                column: "ShiftTeamId");

            migrationBuilder.AddForeignKey(
                name: "FK_Groups_ProductionLines_ProductionLineId",
                table: "Groups",
                column: "ProductionLineId",
                principalTable: "ProductionLines",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Groups_ProductionShiftTeams_ShiftTeamId",
                table: "Groups",
                column: "ShiftTeamId",
                principalTable: "ProductionShiftTeams",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Groups_ProductionLines_ProductionLineId",
                table: "Groups");

            migrationBuilder.DropForeignKey(
                name: "FK_Groups_ProductionShiftTeams_ShiftTeamId",
                table: "Groups");

            migrationBuilder.DropIndex(
                name: "IX_Groups_LineShift",
                table: "Groups");

            migrationBuilder.DropIndex(
                name: "IX_Groups_ShiftTeamId",
                table: "Groups");

            migrationBuilder.DropColumn(
                name: "ProductionLineId",
                table: "Groups");

            migrationBuilder.DropColumn(
                name: "ShiftTeamId",
                table: "Groups");
        }
    }
}

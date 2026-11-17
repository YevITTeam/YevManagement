using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Attendance.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class WorkCalendarPerWorkshop : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_WorkCalendarDays_Date",
                table: "WorkCalendarDays");

            migrationBuilder.AddColumn<int>(
                name: "WorkshopId",
                table: "WorkCalendarDays",
                type: "int",
                nullable: false,
                defaultValue: 0);

            // The single company calendar so far was Di An's; other workshops start empty (Sundays only).
            migrationBuilder.Sql(
                "UPDATE WorkCalendarDays SET WorkshopId = COALESCE((SELECT TOP 1 Id FROM Workshops WHERE WorkshopCode = N'DA'), (SELECT MIN(Id) FROM Workshops))");

            migrationBuilder.CreateIndex(
                name: "IX_WorkCalendarDays_WorkshopId_Date",
                table: "WorkCalendarDays",
                columns: new[] { "WorkshopId", "Date" },
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_WorkCalendarDays_Workshops_WorkshopId",
                table: "WorkCalendarDays",
                column: "WorkshopId",
                principalTable: "Workshops",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_WorkCalendarDays_Workshops_WorkshopId",
                table: "WorkCalendarDays");

            migrationBuilder.DropIndex(
                name: "IX_WorkCalendarDays_WorkshopId_Date",
                table: "WorkCalendarDays");

            // Back to one company calendar: keep Di An's rows so the old unique index on Date can be rebuilt.
            migrationBuilder.Sql(
                "DELETE FROM WorkCalendarDays WHERE WorkshopId <> COALESCE((SELECT TOP 1 Id FROM Workshops WHERE WorkshopCode = N'DA'), (SELECT MIN(Id) FROM Workshops))");

            migrationBuilder.DropColumn(
                name: "WorkshopId",
                table: "WorkCalendarDays");

            migrationBuilder.CreateIndex(
                name: "IX_WorkCalendarDays_Date",
                table: "WorkCalendarDays",
                column: "Date",
                unique: true);
        }
    }
}

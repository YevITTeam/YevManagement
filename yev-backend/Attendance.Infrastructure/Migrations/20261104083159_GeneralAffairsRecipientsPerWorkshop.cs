using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Attendance.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class GeneralAffairsRecipientsPerWorkshop : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "GeneralAffairsEmails",
                table: "Workshops",
                type: "nvarchar(1000)",
                maxLength: 1000,
                nullable: true);

            // The old shared list becomes every workshop's starting list; EXEC so the scripted batch binds the new column.
            migrationBuilder.Sql("EXEC(N'UPDATE Workshops SET GeneralAffairsEmails = (SELECT TOP 1 GeneralAffairsEmails FROM AttendanceSettings)')");

            migrationBuilder.DropColumn(
                name: "GeneralAffairsEmails",
                table: "AttendanceSettings");

            migrationBuilder.AddColumn<int>(
                name: "WorkshopId",
                table: "GeneralAffairsDispatches",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.Sql(@"EXEC(N'UPDATE d SET WorkshopId = ISNULL((SELECT TOP 1 f.WorkshopId FROM OtForms f
    WHERE f.IsProductionForm = 0 AND f.GeneralAffairsSentDate = d.OtDate ORDER BY f.Id), 0)
FROM GeneralAffairsDispatches d')");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "GeneralAffairsEmails",
                table: "Workshops");

            migrationBuilder.DropColumn(
                name: "WorkshopId",
                table: "GeneralAffairsDispatches");

            migrationBuilder.AddColumn<string>(
                name: "GeneralAffairsEmails",
                table: "AttendanceSettings",
                type: "nvarchar(1000)",
                maxLength: 1000,
                nullable: true);
        }
    }
}

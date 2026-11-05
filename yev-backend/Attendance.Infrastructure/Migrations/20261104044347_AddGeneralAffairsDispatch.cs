using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Attendance.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddGeneralAffairsDispatch : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "GeneralAffairsResendPending",
                table: "OtForms",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateOnly>(
                name: "GeneralAffairsSentDate",
                table: "OtForms",
                type: "date",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "GeneralAffairsEmails",
                table: "AttendanceSettings",
                type: "nvarchar(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<TimeOnly>(
                name: "GeneralAffairsSendTime",
                table: "AttendanceSettings",
                type: "time",
                nullable: false,
                defaultValue: new TimeOnly(0, 0, 0));

            migrationBuilder.AddColumn<DateOnly>(
                name: "LastGeneralAffairsSendDate",
                table: "AttendanceSettings",
                type: "date",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "GeneralAffairsDispatches",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    OtDate = table.Column<DateOnly>(type: "date", nullable: false),
                    Version = table.Column<int>(type: "int", nullable: false),
                    FormCount = table.Column<int>(type: "int", nullable: false),
                    MailLogId = table.Column<long>(type: "bigint", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_GeneralAffairsDispatches", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_GeneralAffairsDispatches_OtDate",
                table: "GeneralAffairsDispatches",
                column: "OtDate");

            // EXEC defers name binding, so the scripted form also runs in the same batch as the ADD COLUMN.
            migrationBuilder.Sql("EXEC(N'UPDATE AttendanceSettings SET GeneralAffairsSendTime = ''17:00''')");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "GeneralAffairsDispatches");

            migrationBuilder.DropColumn(
                name: "GeneralAffairsResendPending",
                table: "OtForms");

            migrationBuilder.DropColumn(
                name: "GeneralAffairsSentDate",
                table: "OtForms");

            migrationBuilder.DropColumn(
                name: "GeneralAffairsEmails",
                table: "AttendanceSettings");

            migrationBuilder.DropColumn(
                name: "GeneralAffairsSendTime",
                table: "AttendanceSettings");

            migrationBuilder.DropColumn(
                name: "LastGeneralAffairsSendDate",
                table: "AttendanceSettings");
        }
    }
}

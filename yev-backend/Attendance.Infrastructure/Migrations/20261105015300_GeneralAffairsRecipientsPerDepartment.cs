using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Attendance.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class GeneralAffairsRecipientsPerDepartment : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "DepartmentId",
                table: "GeneralAffairsDispatches",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateTable(
                name: "GeneralAffairsRecipients",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    WorkshopId = table.Column<int>(type: "int", nullable: false),
                    DepartmentId = table.Column<int>(type: "int", nullable: false),
                    Emails = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_GeneralAffairsRecipients", x => x.Id);
                    table.ForeignKey(
                        name: "FK_GeneralAffairsRecipients_Departments_DepartmentId",
                        column: x => x.DepartmentId,
                        principalTable: "Departments",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_GeneralAffairsRecipients_Workshops_WorkshopId",
                        column: x => x.WorkshopId,
                        principalTable: "Workshops",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_GeneralAffairsRecipients_DepartmentId",
                table: "GeneralAffairsRecipients",
                column: "DepartmentId");

            migrationBuilder.CreateIndex(
                name: "IX_GeneralAffairsRecipients_WorkshopId_DepartmentId",
                table: "GeneralAffairsRecipients",
                columns: new[] { "WorkshopId", "DepartmentId" },
                unique: true);

            // Each department of a workshop starts with that workshop's former recipients.
            migrationBuilder.Sql(@"
INSERT INTO GeneralAffairsRecipients (WorkshopId, DepartmentId, Emails)
SELECT w.Id, d.Id, w.GeneralAffairsEmails
FROM Workshops w CROSS JOIN Departments d
WHERE w.GeneralAffairsEmails IS NOT NULL AND w.IsDeleted = 0 AND d.IsDeleted = 0;");

            migrationBuilder.DropColumn(
                name: "GeneralAffairsEmails",
                table: "Workshops");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "GeneralAffairsRecipients");

            migrationBuilder.DropColumn(
                name: "DepartmentId",
                table: "GeneralAffairsDispatches");

            migrationBuilder.AddColumn<string>(
                name: "GeneralAffairsEmails",
                table: "Workshops",
                type: "nvarchar(1000)",
                maxLength: 1000,
                nullable: true);
        }
    }
}

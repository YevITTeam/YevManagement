using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Attendance.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class GroupStepwiseEdit : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "StepwiseEdit",
                table: "Groups",
                type: "bit",
                nullable: false,
                defaultValue: false);

            // Chế tạo asked for stepwise editing on all its groups; other departments keep creator-only editing.
            migrationBuilder.Sql("UPDATE g SET StepwiseEdit = 1 FROM Groups g JOIN Departments d ON d.Id = g.DepartmentId WHERE d.DepartmentCode = N'PRO'");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "StepwiseEdit",
                table: "Groups");
        }
    }
}

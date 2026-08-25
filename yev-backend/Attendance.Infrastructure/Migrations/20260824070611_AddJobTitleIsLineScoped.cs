using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Attendance.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddJobTitleIsLineScoped : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsLineScoped",
                table: "JobTitles",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.Sql(@"UPDATE JobTitles SET IsLineScoped = 1 WHERE Code = N'LL' AND IsDeleted = 0;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "IsLineScoped",
                table: "JobTitles");
        }
    }
}

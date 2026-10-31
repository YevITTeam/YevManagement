using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Attendance.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddResubmitSkipsIntermediate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "ResubmitSkipsIntermediate",
                table: "GroupApprovalSteps",
                type: "bit",
                nullable: false,
                defaultValue: false);

            // Groups already flagged went straight back to the Manager; keep that. EXEC defers compiling past the ADD in SQL scripts.
            migrationBuilder.Sql("EXEC(N'UPDATE [GroupApprovalSteps] SET [ResubmitSkipsIntermediate] = 1 WHERE [CanResubmit] = 1');");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ResubmitSkipsIntermediate",
                table: "GroupApprovalSteps");
        }
    }
}

using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Attendance.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddOtPerformanceIndexes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateIndex(
                name: "IX_OtForms_Date",
                table: "OtForms",
                column: "Date");

            migrationBuilder.CreateIndex(
                name: "IX_OtFormApprovalStepCandidates_UserName",
                table: "OtFormApprovalStepCandidates",
                column: "UserName");

            migrationBuilder.CreateIndex(
                name: "IX_EmployeeAccumulationHistories_Year_Month",
                table: "EmployeeAccumulationHistories",
                columns: new[] { "Year", "Month" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_OtForms_Date",
                table: "OtForms");

            migrationBuilder.DropIndex(
                name: "IX_OtFormApprovalStepCandidates_UserName",
                table: "OtFormApprovalStepCandidates");

            migrationBuilder.DropIndex(
                name: "IX_EmployeeAccumulationHistories_Year_Month",
                table: "EmployeeAccumulationHistories");
        }
    }
}

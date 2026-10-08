using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Attendance.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddApprovalDelegations : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "OnBehalfOfFullName",
                table: "OtFormApprovalHistories",
                type: "nvarchar(255)",
                maxLength: 255,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "OnBehalfOfUserName",
                table: "OtFormApprovalHistories",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "ApprovalDelegations",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    DelegatorEmployeeId = table.Column<int>(type: "int", nullable: false),
                    DelegateEmployeeId = table.Column<int>(type: "int", nullable: false),
                    FromDate = table.Column<DateOnly>(type: "date", nullable: false),
                    ToDate = table.Column<DateOnly>(type: "date", nullable: false),
                    Reason = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ApprovalDelegations", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ApprovalDelegations_Employees_DelegateEmployeeId",
                        column: x => x.DelegateEmployeeId,
                        principalTable: "Employees",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ApprovalDelegations_Employees_DelegatorEmployeeId",
                        column: x => x.DelegatorEmployeeId,
                        principalTable: "Employees",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ApprovalDelegations_DelegateEmployeeId_FromDate_ToDate",
                table: "ApprovalDelegations",
                columns: new[] { "DelegateEmployeeId", "FromDate", "ToDate" });

            migrationBuilder.CreateIndex(
                name: "IX_ApprovalDelegations_DelegatorEmployeeId",
                table: "ApprovalDelegations",
                column: "DelegatorEmployeeId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ApprovalDelegations");

            migrationBuilder.DropColumn(
                name: "OnBehalfOfFullName",
                table: "OtFormApprovalHistories");

            migrationBuilder.DropColumn(
                name: "OnBehalfOfUserName",
                table: "OtFormApprovalHistories");
        }
    }
}

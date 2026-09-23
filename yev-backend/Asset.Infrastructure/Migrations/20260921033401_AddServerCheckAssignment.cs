using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Asset.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddServerCheckAssignment : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_ServerCheckSessions_CheckDate",
                table: "ServerCheckSessions");

            migrationBuilder.AddColumn<int>(
                name: "BranchId",
                table: "ServerCheckSessions",
                type: "int",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "ServerCheckAssignments",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    UserId = table.Column<int>(type: "int", nullable: false),
                    UserName = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false),
                    FullName = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: true),
                    BranchId = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ServerCheckAssignments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ServerCheckAssignments_Branches_BranchId",
                        column: x => x.BranchId,
                        principalTable: "Branches",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ServerCheckSessions_BranchId",
                table: "ServerCheckSessions",
                column: "BranchId");

            migrationBuilder.CreateIndex(
                name: "IX_ServerCheckSessions_CheckDate_BranchId",
                table: "ServerCheckSessions",
                columns: new[] { "CheckDate", "BranchId" },
                unique: true,
                filter: "[BranchId] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_ServerCheckAssignments_BranchId",
                table: "ServerCheckAssignments",
                column: "BranchId");

            migrationBuilder.CreateIndex(
                name: "IX_ServerCheckAssignments_UserId",
                table: "ServerCheckAssignments",
                column: "UserId",
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_ServerCheckSessions_Branches_BranchId",
                table: "ServerCheckSessions",
                column: "BranchId",
                principalTable: "Branches",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ServerCheckSessions_Branches_BranchId",
                table: "ServerCheckSessions");

            migrationBuilder.DropTable(
                name: "ServerCheckAssignments");

            migrationBuilder.DropIndex(
                name: "IX_ServerCheckSessions_BranchId",
                table: "ServerCheckSessions");

            migrationBuilder.DropIndex(
                name: "IX_ServerCheckSessions_CheckDate_BranchId",
                table: "ServerCheckSessions");

            migrationBuilder.DropColumn(
                name: "BranchId",
                table: "ServerCheckSessions");

            migrationBuilder.CreateIndex(
                name: "IX_ServerCheckSessions_CheckDate",
                table: "ServerCheckSessions",
                column: "CheckDate",
                unique: true);
        }
    }
}

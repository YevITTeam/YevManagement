using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Workflow.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddFormAccesses : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "FormAccesses",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    FormDefinitionId = table.Column<int>(type: "int", nullable: false),
                    TargetType = table.Column<int>(type: "int", nullable: false),
                    RoleId = table.Column<int>(type: "int", nullable: true),
                    OrgUnitId = table.Column<int>(type: "int", nullable: true),
                    EmployeeId = table.Column<int>(type: "int", nullable: true),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FormAccesses", x => x.Id);
                    table.ForeignKey(
                        name: "FK_FormAccesses_Employees_EmployeeId",
                        column: x => x.EmployeeId,
                        principalTable: "Employees",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_FormAccesses_FormDefinitions_FormDefinitionId",
                        column: x => x.FormDefinitionId,
                        principalTable: "FormDefinitions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_FormAccesses_OrgUnits_OrgUnitId",
                        column: x => x.OrgUnitId,
                        principalTable: "OrgUnits",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_FormAccesses_EmployeeId",
                table: "FormAccesses",
                column: "EmployeeId");

            migrationBuilder.CreateIndex(
                name: "IX_FormAccesses_FormDefinitionId_TargetType_RoleId_OrgUnitId_EmployeeId",
                table: "FormAccesses",
                columns: new[] { "FormDefinitionId", "TargetType", "RoleId", "OrgUnitId", "EmployeeId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_FormAccesses_OrgUnitId",
                table: "FormAccesses",
                column: "OrgUnitId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "FormAccesses");
        }
    }
}

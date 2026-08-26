using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Workflow.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddFormDesignCatalog : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "FormCategories",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Code = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    NameVn = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    NameJp = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    OrgUnitId = table.Column<int>(type: "int", nullable: true),
                    SortOrder = table.Column<int>(type: "int", nullable: false),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FormCategories", x => x.Id);
                    table.ForeignKey(
                        name: "FK_FormCategories_OrgUnits_OrgUnitId",
                        column: x => x.OrgUnitId,
                        principalTable: "OrgUnits",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "FormDataSources",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Code = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    NameVn = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    NameJp = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    SourceKind = table.Column<int>(type: "int", nullable: false),
                    ConnectionName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    SqlText = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ValueColumn = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    DisplayColumn = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    FilterJson = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FormDataSources", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "FormCategoryCoordinators",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    FormCategoryId = table.Column<int>(type: "int", nullable: false),
                    EmployeeId = table.Column<int>(type: "int", nullable: false),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FormCategoryCoordinators", x => x.Id);
                    table.ForeignKey(
                        name: "FK_FormCategoryCoordinators_Employees_EmployeeId",
                        column: x => x.EmployeeId,
                        principalTable: "Employees",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_FormCategoryCoordinators_FormCategories_FormCategoryId",
                        column: x => x.FormCategoryId,
                        principalTable: "FormCategories",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_FormCategories_Code",
                table: "FormCategories",
                column: "Code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_FormCategories_OrgUnitId",
                table: "FormCategories",
                column: "OrgUnitId");

            migrationBuilder.CreateIndex(
                name: "IX_FormCategoryCoordinators_EmployeeId",
                table: "FormCategoryCoordinators",
                column: "EmployeeId");

            migrationBuilder.CreateIndex(
                name: "IX_FormCategoryCoordinators_FormCategoryId_EmployeeId",
                table: "FormCategoryCoordinators",
                columns: new[] { "FormCategoryId", "EmployeeId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_FormDataSources_Code",
                table: "FormDataSources",
                column: "Code",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "FormCategoryCoordinators");

            migrationBuilder.DropTable(
                name: "FormDataSources");

            migrationBuilder.DropTable(
                name: "FormCategories");
        }
    }
}

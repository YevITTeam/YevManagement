using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Workflow.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddFormDefinitions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "FormDefinitions",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Code = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    NameVn = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    NameJp = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    FormCategoryId = table.Column<int>(type: "int", nullable: false),
                    Description = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    Version = table.Column<int>(type: "int", nullable: false, defaultValue: 1),
                    IsPublished = table.Column<bool>(type: "bit", nullable: false),
                    AllowAttachment = table.Column<bool>(type: "bit", nullable: false),
                    RequireAttachment = table.Column<bool>(type: "bit", nullable: false),
                    CodePrefix = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    RouteConditionType = table.Column<int>(type: "int", nullable: false),
                    RouteNumericFieldKey = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    RouteClassFieldKey = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    CreatedByEmployeeId = table.Column<int>(type: "int", nullable: false),
                    UpdatedByEmployeeId = table.Column<int>(type: "int", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FormDefinitions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_FormDefinitions_Employees_CreatedByEmployeeId",
                        column: x => x.CreatedByEmployeeId,
                        principalTable: "Employees",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_FormDefinitions_Employees_UpdatedByEmployeeId",
                        column: x => x.UpdatedByEmployeeId,
                        principalTable: "Employees",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_FormDefinitions_FormCategories_FormCategoryId",
                        column: x => x.FormCategoryId,
                        principalTable: "FormCategories",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_FormDefinitions_Code",
                table: "FormDefinitions",
                column: "Code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_FormDefinitions_CreatedByEmployeeId",
                table: "FormDefinitions",
                column: "CreatedByEmployeeId");

            migrationBuilder.CreateIndex(
                name: "IX_FormDefinitions_FormCategoryId",
                table: "FormDefinitions",
                column: "FormCategoryId");

            migrationBuilder.CreateIndex(
                name: "IX_FormDefinitions_UpdatedByEmployeeId",
                table: "FormDefinitions",
                column: "UpdatedByEmployeeId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "FormDefinitions");
        }
    }
}

using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Workflow.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddFormFieldsAndConditions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "FormFields",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    FormDefinitionId = table.Column<int>(type: "int", nullable: false),
                    FieldKey = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    LabelVn = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    LabelJp = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    DataType = table.Column<int>(type: "int", nullable: false),
                    IsRequired = table.Column<bool>(type: "bit", nullable: false),
                    SortOrder = table.Column<int>(type: "int", nullable: false),
                    ColumnSpan = table.Column<int>(type: "int", nullable: false, defaultValue: 1),
                    Placeholder = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    DefaultValue = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    OptionsJson = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    MinValue = table.Column<decimal>(type: "decimal(18,4)", nullable: true),
                    MaxValue = table.Column<decimal>(type: "decimal(18,4)", nullable: true),
                    MaxLength = table.Column<int>(type: "int", nullable: true),
                    HelpTextVn = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    FormDataSourceId = table.Column<int>(type: "int", nullable: true),
                    AutoNumberPattern = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    DefaultVisible = table.Column<bool>(type: "bit", nullable: false, defaultValue: true),
                    IsReadOnly = table.Column<bool>(type: "bit", nullable: false),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FormFields", x => x.Id);
                    table.ForeignKey(
                        name: "FK_FormFields_FormDataSources_FormDataSourceId",
                        column: x => x.FormDataSourceId,
                        principalTable: "FormDataSources",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_FormFields_FormDefinitions_FormDefinitionId",
                        column: x => x.FormDefinitionId,
                        principalTable: "FormDefinitions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "FormFieldConditions",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    TargetFieldId = table.Column<int>(type: "int", nullable: false),
                    SourceFieldId = table.Column<int>(type: "int", nullable: false),
                    Operator = table.Column<int>(type: "int", nullable: false),
                    CompareValue = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    CompareValue2 = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    Effect = table.Column<int>(type: "int", nullable: false),
                    LogicGroup = table.Column<int>(type: "int", nullable: false, defaultValue: 1),
                    SortOrder = table.Column<int>(type: "int", nullable: false),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FormFieldConditions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_FormFieldConditions_FormFields_SourceFieldId",
                        column: x => x.SourceFieldId,
                        principalTable: "FormFields",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_FormFieldConditions_FormFields_TargetFieldId",
                        column: x => x.TargetFieldId,
                        principalTable: "FormFields",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_FormFieldConditions_SourceFieldId",
                table: "FormFieldConditions",
                column: "SourceFieldId");

            migrationBuilder.CreateIndex(
                name: "IX_FormFieldConditions_TargetFieldId",
                table: "FormFieldConditions",
                column: "TargetFieldId");

            migrationBuilder.CreateIndex(
                name: "IX_FormFields_FormDataSourceId",
                table: "FormFields",
                column: "FormDataSourceId");

            migrationBuilder.CreateIndex(
                name: "IX_FormFields_FormDefinitionId_FieldKey",
                table: "FormFields",
                columns: new[] { "FormDefinitionId", "FieldKey" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_FormFields_FormDefinitionId_SortOrder",
                table: "FormFields",
                columns: new[] { "FormDefinitionId", "SortOrder" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "FormFieldConditions");

            migrationBuilder.DropTable(
                name: "FormFields");
        }
    }
}

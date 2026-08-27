using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Workflow.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddOrgLevelJobTitleSuggestions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "OrgLevelJobTitleSuggestions",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    OrgLevelId = table.Column<int>(type: "int", nullable: false),
                    JobTitleId = table.Column<int>(type: "int", nullable: false),
                    SortOrder = table.Column<int>(type: "int", nullable: false),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OrgLevelJobTitleSuggestions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_OrgLevelJobTitleSuggestions_JobTitles_JobTitleId",
                        column: x => x.JobTitleId,
                        principalTable: "JobTitles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_OrgLevelJobTitleSuggestions_OrgLevels_OrgLevelId",
                        column: x => x.OrgLevelId,
                        principalTable: "OrgLevels",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_OrgLevelJobTitleSuggestions_JobTitleId",
                table: "OrgLevelJobTitleSuggestions",
                column: "JobTitleId");

            migrationBuilder.CreateIndex(
                name: "IX_OrgLevelJobTitleSuggestions_OrgLevelId_JobTitleId",
                table: "OrgLevelJobTitleSuggestions",
                columns: new[] { "OrgLevelId", "JobTitleId" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "OrgLevelJobTitleSuggestions");
        }
    }
}

using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Asset.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class UpdateDb_V2 : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Software_SoftwareGroup");

            migrationBuilder.Sql("INSERT INTO SoftwareGroups (GroupCode, GroupName, IsDeleted) VALUES ('DEFAULT', N'Chưa phân nhóm', 0)");

            migrationBuilder.AddColumn<int>(
                name: "SoftwareGroupId",
                table: "Softwares",
                type: "int",
                nullable: false,
                defaultValue: 1); 

            migrationBuilder.CreateIndex(
                name: "IX_PhanMems_NhomPhanMemId",
                table: "Softwares",
                column: "SoftwareGroupId");

            migrationBuilder.AddForeignKey(
                name: "FK_PhanMems_NhomPhanMems_NhomPhanMemId",
                table: "Softwares",
                column: "SoftwareGroupId",
                principalTable: "SoftwareGroups",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_PhanMems_NhomPhanMems_NhomPhanMemId",
                table: "Softwares");

            migrationBuilder.DropIndex(
                name: "IX_PhanMems_NhomPhanMemId",
                table: "Softwares");

            migrationBuilder.DropColumn(
                name: "SoftwareGroupId",
                table: "Softwares");

            migrationBuilder.CreateTable(
                name: "Software_SoftwareGroup",
                columns: table => new
                {
                    SoftwareId = table.Column<int>(type: "int", nullable: false),
                    SoftwareGroupId = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Software_SoftwareGroup", x => new { x.SoftwareId, x.SoftwareGroupId });
                    table.ForeignKey(
                        name: "FK_Software_SoftwareGroup_SoftwareGroups_SoftwareGroupId",
                        column: x => x.SoftwareGroupId,
                        principalTable: "SoftwareGroups",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_Software_SoftwareGroup_Softwares_SoftwareId",
                        column: x => x.SoftwareId,
                        principalTable: "Softwares",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Software_SoftwareGroup_SoftwareGroupId",
                table: "Software_SoftwareGroup",
                column: "SoftwareGroupId");
        }
    }
}

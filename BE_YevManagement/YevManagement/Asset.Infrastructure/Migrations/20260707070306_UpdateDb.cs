using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Asset.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class UpdateDb : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "SoftwareGroups",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    GroupCode = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    GroupName = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: false),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_NhomPhanMems", x => x.Id);
                });

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

            migrationBuilder.CreateIndex(
                name: "IX_NhomPhanMems_MaNhom",
                table: "SoftwareGroups",
                column: "GroupCode",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Software_SoftwareGroup");

            migrationBuilder.DropTable(
                name: "SoftwareGroups");
        }
    }
}
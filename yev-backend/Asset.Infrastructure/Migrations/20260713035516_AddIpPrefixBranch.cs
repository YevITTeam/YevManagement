using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Asset.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddIpPrefixBranch : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "BranchId",
                table: "IpPrefixes",
                type: "int",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_TienToIPs_ChiNhanhId",
                table: "IpPrefixes",
                column: "BranchId");

            migrationBuilder.AddForeignKey(
                name: "FK_TienToIPs_ChiNhanhs_ChiNhanhId",
                table: "IpPrefixes",
                column: "BranchId",
                principalTable: "Branches",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_TienToIPs_ChiNhanhs_ChiNhanhId",
                table: "IpPrefixes");

            migrationBuilder.DropIndex(
                name: "IX_TienToIPs_ChiNhanhId",
                table: "IpPrefixes");

            migrationBuilder.DropColumn(
                name: "BranchId",
                table: "IpPrefixes");
        }
    }
}

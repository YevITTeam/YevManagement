using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Asset.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class RenameServerCheckBranchSetting : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_AssetSettings_Branches_NetworkCheckBranchId",
                table: "AssetSettings");

            migrationBuilder.RenameColumn(
                name: "NetworkCheckBranchId",
                table: "AssetSettings",
                newName: "ServerCheckBranchId");

            migrationBuilder.RenameIndex(
                name: "IX_AssetSettings_NetworkCheckBranchId",
                table: "AssetSettings",
                newName: "IX_AssetSettings_ServerCheckBranchId");

            migrationBuilder.AddForeignKey(
                name: "FK_AssetSettings_Branches_ServerCheckBranchId",
                table: "AssetSettings",
                column: "ServerCheckBranchId",
                principalTable: "Branches",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_AssetSettings_Branches_ServerCheckBranchId",
                table: "AssetSettings");

            migrationBuilder.RenameColumn(
                name: "ServerCheckBranchId",
                table: "AssetSettings",
                newName: "NetworkCheckBranchId");

            migrationBuilder.RenameIndex(
                name: "IX_AssetSettings_ServerCheckBranchId",
                table: "AssetSettings",
                newName: "IX_AssetSettings_NetworkCheckBranchId");

            migrationBuilder.AddForeignKey(
                name: "FK_AssetSettings_Branches_NetworkCheckBranchId",
                table: "AssetSettings",
                column: "NetworkCheckBranchId",
                principalTable: "Branches",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }
    }
}

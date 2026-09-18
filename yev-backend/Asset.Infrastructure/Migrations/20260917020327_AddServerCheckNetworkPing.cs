using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Asset.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddServerCheckNetworkPing : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "UsesNetworkPing",
                table: "ServerCheckManualItems",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<int>(
                name: "NetworkCheckBranchId",
                table: "AssetSettings",
                type: "int",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_AssetSettings_NetworkCheckBranchId",
                table: "AssetSettings",
                column: "NetworkCheckBranchId");

            migrationBuilder.AddForeignKey(
                name: "FK_AssetSettings_Branches_NetworkCheckBranchId",
                table: "AssetSettings",
                column: "NetworkCheckBranchId",
                principalTable: "Branches",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            // Flag the 2 seeded manual items the "Kiểm tra network" ping button applies to
            // (asset-module.md §1.20) — avoids fragile Name string-matching in Service/FE code.
            migrationBuilder.Sql(
                "UPDATE ServerCheckManualItems SET UsesNetworkPing = 1 WHERE Name IN (N'Network - Factory', N'Network - Server');");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_AssetSettings_Branches_NetworkCheckBranchId",
                table: "AssetSettings");

            migrationBuilder.DropIndex(
                name: "IX_AssetSettings_NetworkCheckBranchId",
                table: "AssetSettings");

            migrationBuilder.DropColumn(
                name: "UsesNetworkPing",
                table: "ServerCheckManualItems");

            migrationBuilder.DropColumn(
                name: "NetworkCheckBranchId",
                table: "AssetSettings");
        }
    }
}

using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Asset.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddManualItemMayLanh : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsAirConditioner",
                table: "ServerCheckManualItems",
                type: "bit",
                nullable: false,
                defaultValue: false);

            // Air conditioners are no longer a device category: staff tick OK/NG for them like any manual item
            // (asset-module.md §1.19). DisplayOrder 8 keeps the Excel F..L manual columns (orders 1..7) unchanged;
            // the report reads this row into the dedicated Máy lạnh column via IsAirConditioner.
            migrationBuilder.Sql(@"
                UPDATE DeviceTypes SET ServerCheckCategory = NULL WHERE ServerCheckCategory = 3;

                INSERT INTO ServerCheckManualItems (Name, DisplayOrder, UsesNetworkPing, IsAirConditioner, IsDeleted)
                SELECT N'Máy lạnh', 8, 0, 1, 0
                WHERE NOT EXISTS (SELECT 1 FROM ServerCheckManualItems WHERE IsAirConditioner = 1);");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "IsAirConditioner",
                table: "ServerCheckManualItems");
        }
    }
}

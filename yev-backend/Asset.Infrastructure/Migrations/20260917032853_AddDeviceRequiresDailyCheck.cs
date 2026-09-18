using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Asset.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddDeviceRequiresDailyCheck : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "RequiresDailyCheck",
                table: "Devices",
                type: "bit",
                nullable: false,
                defaultValue: false);

            // The paper form's "Các kiểm tra khác" section also has a Backup column with 3 sub-columns
            // (File Srv / OES / Domain) that the first pass missed — seed them as manual checklist items
            // so the report matches the form 1:1 (asset-module.md §1.19). DisplayOrder continues 5..7,
            // keeping the same left-to-right order as the printed sheet.
            migrationBuilder.Sql(@"
                INSERT INTO ServerCheckManualItems (Name, DisplayOrder, UsesNetworkPing, IsDeleted)
                SELECT N'Backup - File Srv', 5, 0, 0
                WHERE NOT EXISTS (SELECT 1 FROM ServerCheckManualItems WHERE Name = N'Backup - File Srv');

                INSERT INTO ServerCheckManualItems (Name, DisplayOrder, UsesNetworkPing, IsDeleted)
                SELECT N'Backup - OES', 6, 0, 0
                WHERE NOT EXISTS (SELECT 1 FROM ServerCheckManualItems WHERE Name = N'Backup - OES');

                INSERT INTO ServerCheckManualItems (Name, DisplayOrder, UsesNetworkPing, IsDeleted)
                SELECT N'Backup - Domain', 7, 0, 0
                WHERE NOT EXISTS (SELECT 1 FROM ServerCheckManualItems WHERE Name = N'Backup - Domain');
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                "DELETE FROM ServerCheckManualItems WHERE Name IN (N'Backup - File Srv', N'Backup - OES', N'Backup - Domain');");

            migrationBuilder.DropColumn(
                name: "RequiresDailyCheck",
                table: "Devices");
        }
    }
}

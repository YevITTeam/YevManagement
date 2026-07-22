using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Asset.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddDeviceFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsOutsourced",
                table: "Devices",
                type: "bit",
                nullable: false,
                defaultValue: false);

            // Add as NULLABLE first so the existing 5202 rows aren't broken, tighten to NOT NULL after backfilling.
            migrationBuilder.AddColumn<int>(
                name: "DepreciationMonths",
                table: "Devices",
                type: "int",
                nullable: true);

            // Verified read-only before writing this migration: DATEDIFF(MONTH, PurchaseDate,
            // ExpirationDate) matches exactly 100% across all 5202 devices (only 2 values,
            // 60/48 months, no NULLs, no conflicts) -> this backfill is safe.
            migrationBuilder.Sql(@"
UPDATE Devices
SET DepreciationMonths = DATEDIFF(MONTH, PurchaseDate, ExpirationDate);
");

            migrationBuilder.AlterColumn<int>(
                name: "DepreciationMonths",
                table: "Devices",
                type: "int",
                nullable: false,
                oldClrType: typeof(int),
                oldType: "int",
                oldNullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "DepreciationMonths",
                table: "Devices");

            migrationBuilder.DropColumn(
                name: "IsOutsourced",
                table: "Devices");
        }
    }
}

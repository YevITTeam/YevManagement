using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Asset.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class RenameDeviceReplacementToSuggestedNewDevice : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ThietBis_ThietBis_ThayTheChoId",
                table: "Devices");

            migrationBuilder.RenameColumn(
                name: "ReplacesOldDeviceId",
                table: "Devices",
                newName: "SuggestedNewDeviceId");

            // Data fixup: RenameColumn only renames the column in place, it does NOT move data to
            // the correct row. Before this migration, the column (when it was still named ReplacesOldDeviceId)
            // sat on the NEW device's row, pointing to the OLD device; after reversing the self-reference
            // direction, the column must sit on the OLD device's row, pointing to the NEW device — so the
            // existing values need to be moved to the opposite row. If multiple new devices declare the same
            // "Old Device" pointing to one old device (through several separate imports), only keep the new
            // device with the largest Id (most recent import), matching the old "pick the most recent suggestion"
            // logic previously in DeviceService.GetReplacementSuggestionAsync.
            migrationBuilder.Sql(@"
SELECT Id AS NewDeviceId, SuggestedNewDeviceId AS OldDeviceId
INTO #ReplacementPairs
FROM Devices
WHERE SuggestedNewDeviceId IS NOT NULL;

UPDATE Devices SET SuggestedNewDeviceId = NULL WHERE SuggestedNewDeviceId IS NOT NULL;

;WITH LatestSuggestion AS (
    SELECT OldDeviceId, NewDeviceId,
           ROW_NUMBER() OVER (PARTITION BY OldDeviceId ORDER BY NewDeviceId DESC) AS rn
    FROM #ReplacementPairs
)
UPDATE d
SET d.SuggestedNewDeviceId = ls.NewDeviceId
FROM Devices d
INNER JOIN LatestSuggestion ls ON d.Id = ls.OldDeviceId AND ls.rn = 1;

DROP TABLE #ReplacementPairs;
");

            migrationBuilder.RenameIndex(
                name: "IX_ThietBis_ThayTheChoId",
                table: "Devices",
                newName: "IX_ThietBis_GoiYMayMoiId");

            migrationBuilder.AddForeignKey(
                name: "FK_ThietBis_ThietBis_GoiYMayMoiId",
                table: "Devices",
                column: "SuggestedNewDeviceId",
                principalTable: "Devices",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ThietBis_ThietBis_GoiYMayMoiId",
                table: "Devices");

            // Reverse data fixup (best-effort — if Up() ever merged multiple new devices pointing
            // to the same old device into a single row, Down() cannot restore the merged rows,
            // it only restores the remaining 1-1 relationships at the time of rollback).
            migrationBuilder.Sql(@"
SELECT Id AS OldDeviceId, SuggestedNewDeviceId AS NewDeviceId
INTO #ReplacementPairs
FROM Devices
WHERE SuggestedNewDeviceId IS NOT NULL;

UPDATE Devices SET SuggestedNewDeviceId = NULL WHERE SuggestedNewDeviceId IS NOT NULL;

UPDATE d
SET d.SuggestedNewDeviceId = p.OldDeviceId
FROM Devices d
INNER JOIN #ReplacementPairs p ON d.Id = p.NewDeviceId;

DROP TABLE #ReplacementPairs;
");

            migrationBuilder.RenameColumn(
                name: "SuggestedNewDeviceId",
                table: "Devices",
                newName: "ReplacesOldDeviceId");

            migrationBuilder.RenameIndex(
                name: "IX_ThietBis_GoiYMayMoiId",
                table: "Devices",
                newName: "IX_ThietBis_ThayTheChoId");

            migrationBuilder.AddForeignKey(
                name: "FK_ThietBis_ThietBis_ThayTheChoId",
                table: "Devices",
                column: "ReplacesOldDeviceId",
                principalTable: "Devices",
                principalColumn: "Id");
        }
    }
}

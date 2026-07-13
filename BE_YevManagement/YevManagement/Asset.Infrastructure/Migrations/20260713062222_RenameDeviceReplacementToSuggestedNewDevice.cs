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

            // Data fixup: RenameColumn chỉ đổi tên cột tại chỗ, KHÔNG di chuyển dữ liệu sang
            // đúng dòng. Trước migration này, cột (khi còn tên ReplacesOldDeviceId) nằm trên
            // dòng máy MỚI, trỏ về máy CŨ; sau khi đổi hướng tự tham chiếu, cột phải nằm trên
            // dòng máy CŨ, trỏ về máy MỚI — nên cần chuyển giá trị hiện có sang đúng dòng đối
            // diện. Nếu nhiều máy mới cùng khai "MQL Cũ" trỏ về 1 máy cũ (qua nhiều lần import
            // khác nhau), chỉ giữ lại máy mới có Id lớn nhất (import gần nhất), khớp đúng logic
            // "chọn gợi ý gần nhất" cũ ở DeviceService.GetReplacementSuggestionAsync trước đây.
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

            // Data fixup ngược (best-effort — nếu Up() từng gộp nhiều máy mới cùng trỏ 1 máy
            // cũ thành 1 dòng duy nhất thì Down() không khôi phục lại được các dòng đã gộp,
            // chỉ khôi phục đúng quan hệ 1-1 còn lại tại thời điểm rollback).
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

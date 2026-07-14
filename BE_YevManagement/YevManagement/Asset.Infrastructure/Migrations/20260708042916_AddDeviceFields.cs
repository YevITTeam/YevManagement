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

            // Thêm NULLABLE trước để không vỡ 5202 dòng hiện có, backfill xong mới siết NOT NULL.
            migrationBuilder.AddColumn<int>(
                name: "DepreciationMonths",
                table: "Devices",
                type: "int",
                nullable: true);

            // Đã kiểm chứng read-only trước khi viết migration: DATEDIFF(MONTH, PurchaseDate,
            // ExpirationDate) khớp chính xác 100% trên toàn bộ 5202 thiết bị (chỉ 2 giá trị
            // 60/48 tháng, không NULL, không xung đột) -> backfill này an toàn.
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

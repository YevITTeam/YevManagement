using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Asset.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class ChangeDeviceGroupDepartmentRelation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Xoá data cũ trước khi đổi DeviceGroup.DepartmentId sang NOT NULL (quyết định người
            // dùng 2026-07-13): DeviceGroups chỉ có 1 dòng seed "MD", DeviceDepartments có "MD" +
            // "IT" tự thêm tay — chưa Device nào tham chiếu (đã kiểm tra trên DB thật trước khi
            // viết migration này) nên xoá cứng an toàn, tránh lẫn với bộ mã chính thức nhập bên
            // dưới. Phải xoá DeviceGroups trước (con) rồi mới tới DeviceDepartments (cha, còn bị
            // FK ràng buộc).
            migrationBuilder.Sql("DELETE FROM DeviceGroups;");
            migrationBuilder.Sql("DELETE FROM DeviceDepartments;");

            migrationBuilder.DropIndex(
                name: "IX_Nhoms_MaNhom",
                table: "DeviceGroups");

            migrationBuilder.AddColumn<int>(
                name: "DepartmentId",
                table: "DeviceGroups",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateIndex(
                name: "IX_Nhoms_BoPhanId_MaNhom",
                table: "DeviceGroups",
                columns: new[] { "DepartmentId", "GroupCode" },
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_Nhoms_BoPhans_BoPhanId",
                table: "DeviceGroups",
                column: "DepartmentId",
                principalTable: "DeviceDepartments",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            // Import bộ mã Bộ phận/Nhóm chính thức theo ảnh sơ đồ tổ chức (2026-07-13). 15 mã
            // Nhóm chưa có tên đầy đủ trong chú thích ảnh (HZ/YT/PD/EC/JK/MA/IM/IT/PL/PR/WH/SH/
            // KS/00/JP) tạm để GroupName = đúng mã Code — sửa lại tên thật qua API Update sau khi
            // có thông tin đầy đủ.
            migrationBuilder.Sql(@"
INSERT INTO DeviceDepartments (DepartmentCode, DepartmentName, IsDeleted) VALUES
(N'MAN', N'P Quản lý', 0),
(N'ADM', N'Tổng vụ', 0),
(N'DES', N'CBSX', 0),
(N'ENG', N'KTSX', 0),
(N'PCD', N'Công vụ', 0),
(N'PRO', N'Sản xuất', 0),
(N'QAD', N'Quản lý chất lượng', 0),
(N'MZK', N'P Monozukuri', 0),
(N'000', N'Chung', 0);

INSERT INTO DeviceGroups (DepartmentId, GroupCode, GroupName, IsDeleted)
SELECT d.Id, v.GroupCode, v.GroupName, 0
FROM (VALUES
    (N'MAN', N'AC', N'Kế toán'),
    (N'MAN', N'CO', N'Giá thành'),
    (N'MAN', N'LE', N'Pháp lý'),
    (N'MAN', N'PU', N'Nhóm mua hàng (PQL)'),
    (N'ADM', N'OF', N'Office (Văn phòng)'),
    (N'ADM', N'HZ', N'HZ'),
    (N'ADM', N'YT', N'YT'),
    (N'DES', N'PD', N'PD'),
    (N'ENG', N'EC', N'EC'),
    (N'ENG', N'JK', N'JK'),
    (N'ENG', N'MA', N'MA'),
    (N'PCD', N'IM', N'IM'),
    (N'PCD', N'IT', N'IT'),
    (N'PCD', N'PL', N'PL'),
    (N'PCD', N'PR', N'PR'),
    (N'PCD', N'WH', N'WH'),
    (N'PCD', N'SH', N'SH'),
    (N'PRO', N'OT', N'Sản xuất trực tiếp'),
    (N'QAD', N'KS', N'KS'),
    (N'QAD', N'OF', N'Office (Văn phòng)'),
    (N'QAD', N'IO', N'Nhóm ISO'),
    (N'QAD', N'QU', N'Kiểm tra nhận vào'),
    (N'QAD', N'QT', N'Tenaoshi'),
    (N'QAD', N'LQ', N'Nhóm LQC'),
    (N'MZK', N'TN', N'Nhóm Đào tạo (P Monozukuri)'),
    (N'MZK', N'NY', N'Nhóm XTCT (P Monozukuri)'),
    (N'000', N'00', N'00'),
    (N'000', N'JP', N'JP')
) AS v(DepartmentCode, GroupCode, GroupName)
JOIN DeviceDepartments d ON d.DepartmentCode = v.DepartmentCode;
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Xoá sạch data import ở Up() trước khi bỏ cột — không khôi phục lại "MD"/"IT" cũ vì
            // dữ liệu đó vốn đã bị coi là rác cần dọn (xem lý do ở Up()).
            migrationBuilder.Sql("DELETE FROM DeviceGroups;");
            migrationBuilder.Sql("DELETE FROM DeviceDepartments;");

            migrationBuilder.DropForeignKey(
                name: "FK_Nhoms_BoPhans_BoPhanId",
                table: "DeviceGroups");

            migrationBuilder.DropIndex(
                name: "IX_Nhoms_BoPhanId_MaNhom",
                table: "DeviceGroups");

            migrationBuilder.DropColumn(
                name: "DepartmentId",
                table: "DeviceGroups");

            migrationBuilder.CreateIndex(
                name: "IX_Nhoms_MaNhom",
                table: "DeviceGroups",
                column: "GroupCode",
                unique: true);
        }
    }
}

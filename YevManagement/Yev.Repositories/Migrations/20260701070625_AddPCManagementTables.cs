using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Yev.Repositories.Migrations
{
    /// <inheritdoc />
    public partial class AddPCManagementTables : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "AuditTrails",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    TableName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    RecordId = table.Column<int>(type: "int", nullable: false),
                    Action = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    OldValues = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    NewValues = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ChangedBy = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false),
                    ChagedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AuditTrails", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ChiNhanhs",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    MaChiNhanh = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    TenChiNhanh = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: false),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ChiNhanhs", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "LoaiThietBis",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    MaLoai = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    TenLoai = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: false),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LoaiThietBis", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "NhaCungCaps",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    MaNhaCungCap = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    TenNhaCungCap = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: false),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_NhaCungCaps", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "PhanMems",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    MaPhanMem = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    TenPhanMem = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: false),
                    NhaPhatHanh = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: true),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PhanMems", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ThietBis",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    MaMay = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    TenMay = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: false),
                    LoaiThietBiId = table.Column<int>(type: "int", nullable: false),
                    NhaCungCapId = table.Column<int>(type: "int", nullable: false),
                    ChiNhanhId = table.Column<int>(type: "int", nullable: false),
                    NguoiQuanLy = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false),
                    Email = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: false),
                    NgayMua = table.Column<DateTime>(type: "datetime2", nullable: false),
                    HanSuDung = table.Column<DateTime>(type: "datetime2", nullable: true),
                    TrangThai = table.Column<int>(type: "int", nullable: false),
                    GhiChu = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ThietBis", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ThietBis_ChiNhanhs_ChiNhanhId",
                        column: x => x.ChiNhanhId,
                        principalTable: "ChiNhanhs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ThietBis_LoaiThietBis_LoaiThietBiId",
                        column: x => x.LoaiThietBiId,
                        principalTable: "LoaiThietBis",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ThietBis_NhaCungCaps_NhaCungCapId",
                        column: x => x.NhaCungCapId,
                        principalTable: "NhaCungCaps",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "CauHinhThietBis",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ThietBiId = table.Column<int>(type: "int", nullable: false),
                    Mainboard = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: true),
                    CPU = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: true),
                    RAM = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: true),
                    OCung = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: true),
                    Monitor = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: true),
                    Mouse = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: true),
                    Keyboard = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: true),
                    Headphone = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: true),
                    Speaker = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: true),
                    UPS = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: true),
                    PSU = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: true),
                    OS = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: true),
                    VGA = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: true),
                    GhiChu = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CauHinhThietBis", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CauHinhThietBis_ThietBis_ThietBiId",
                        column: x => x.ThietBiId,
                        principalTable: "ThietBis",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "DiaChiIPs",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    DiaChi = table.Column<string>(type: "nvarchar(25)", maxLength: 25, nullable: false),
                    SubnetMask = table.Column<string>(type: "nvarchar(15)", maxLength: 15, nullable: true),
                    Gateway = table.Column<string>(type: "nvarchar(15)", maxLength: 15, nullable: true),
                    PreferredDNS = table.Column<string>(type: "nvarchar(15)", maxLength: 15, nullable: true),
                    AlternateDNS = table.Column<string>(type: "nvarchar(15)", maxLength: 15, nullable: true),
                    ServerIP = table.Column<string>(type: "nvarchar(15)", maxLength: 15, nullable: true),
                    ThietBiId = table.Column<int>(type: "int", nullable: true),
                    TrangThai = table.Column<int>(type: "int", nullable: false),
                    GhiChu = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: true),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DiaChiIPs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_DiaChiIPs_ThietBis_ThietBiId",
                        column: x => x.ThietBiId,
                        principalTable: "ThietBis",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "LichSuChuyenDois",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    IdMayCu = table.Column<int>(type: "int", nullable: false),
                    IdMayMoi = table.Column<int>(type: "int", nullable: false),
                    NgayChuyenDoi = table.Column<DateTime>(type: "datetime2", nullable: false),
                    GhiChu = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LichSuChuyenDois", x => x.Id);
                    table.ForeignKey(
                        name: "FK_LichSuChuyenDois_ThietBis_IdMayCu",
                        column: x => x.IdMayCu,
                        principalTable: "ThietBis",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_LichSuChuyenDois_ThietBis_IdMayMoi",
                        column: x => x.IdMayMoi,
                        principalTable: "ThietBis",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "ThietBi_PhanMems",
                columns: table => new
                {
                    ThietBiId = table.Column<int>(type: "int", nullable: false),
                    PhanMemId = table.Column<int>(type: "int", nullable: false),
                    NgayCaiDat = table.Column<DateTime>(type: "datetime2", nullable: false),
                    LicenseKey = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ThietBi_PhanMems", x => new { x.ThietBiId, x.PhanMemId });
                    table.ForeignKey(
                        name: "FK_ThietBi_PhanMems_PhanMems_PhanMemId",
                        column: x => x.PhanMemId,
                        principalTable: "PhanMems",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ThietBi_PhanMems_ThietBis_ThietBiId",
                        column: x => x.ThietBiId,
                        principalTable: "ThietBis",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_CauHinhThietBis_ThietBiId",
                table: "CauHinhThietBis",
                column: "ThietBiId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ChiNhanhs_MaChiNhanh",
                table: "ChiNhanhs",
                column: "MaChiNhanh",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_DiaChiIPs_DiaChi",
                table: "DiaChiIPs",
                column: "DiaChi",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_DiaChiIPs_ThietBiId",
                table: "DiaChiIPs",
                column: "ThietBiId");

            migrationBuilder.CreateIndex(
                name: "IX_LichSuChuyenDois_IdMayCu",
                table: "LichSuChuyenDois",
                column: "IdMayCu");

            migrationBuilder.CreateIndex(
                name: "IX_LichSuChuyenDois_IdMayMoi",
                table: "LichSuChuyenDois",
                column: "IdMayMoi");

            migrationBuilder.CreateIndex(
                name: "IX_LoaiThietBis_MaLoai",
                table: "LoaiThietBis",
                column: "MaLoai",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_NhaCungCaps_MaNhaCungCap",
                table: "NhaCungCaps",
                column: "MaNhaCungCap",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PhanMems_MaPhanMem",
                table: "PhanMems",
                column: "MaPhanMem",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ThietBi_PhanMems_PhanMemId",
                table: "ThietBi_PhanMems",
                column: "PhanMemId");

            migrationBuilder.CreateIndex(
                name: "IX_ThietBis_ChiNhanhId",
                table: "ThietBis",
                column: "ChiNhanhId");

            migrationBuilder.CreateIndex(
                name: "IX_ThietBis_LoaiThietBiId",
                table: "ThietBis",
                column: "LoaiThietBiId");

            migrationBuilder.CreateIndex(
                name: "IX_ThietBis_MaMay",
                table: "ThietBis",
                column: "MaMay",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ThietBis_NhaCungCapId",
                table: "ThietBis",
                column: "NhaCungCapId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AuditTrails");

            migrationBuilder.DropTable(
                name: "CauHinhThietBis");

            migrationBuilder.DropTable(
                name: "DiaChiIPs");

            migrationBuilder.DropTable(
                name: "LichSuChuyenDois");

            migrationBuilder.DropTable(
                name: "ThietBi_PhanMems");

            migrationBuilder.DropTable(
                name: "PhanMems");

            migrationBuilder.DropTable(
                name: "ThietBis");

            migrationBuilder.DropTable(
                name: "ChiNhanhs");

            migrationBuilder.DropTable(
                name: "LoaiThietBis");

            migrationBuilder.DropTable(
                name: "NhaCungCaps");
        }
    }
}

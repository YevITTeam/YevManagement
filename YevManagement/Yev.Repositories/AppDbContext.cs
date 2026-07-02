using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Text;
using Yev.Entities.Catalogs;
using Yev.Entities.Devices;
using Yev.Entities.Logs;
using Yev.Entities.Users;

namespace Yev.Repositories
{
    public class AppDbContext : DbContext
    {
        public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }
        public DbSet<User> Users { get; set; }
        public DbSet<Role> Roles { get; set; }
        public DbSet<UserRole> UserRoles { get; set; }

        // --- CÁC BẢNG QUẢN LÝ PC ---
        public DbSet<ChiNhanh> ChiNhanhs { get; set; }
        public DbSet<NhaCungCap> NhaCungCaps { get; set; }
        public DbSet<LoaiThietBi> LoaiThietBis { get; set; }
        public DbSet<PhanMem> PhanMems { get; set; }
        public DbSet<ThietBi> ThietBis { get; set; }
        public DbSet<DiaChiIP> DiaChiIPs { get; set; }
        public DbSet<CauHinhThietBi> CauHinhThietBis { get; set; }
        public DbSet<ThietBi_PhanMem> ThietBi_PhanMems { get; set; }
        public DbSet<LichSuChuyenDoi> LichSuChuyenDois { get; set; }
        public DbSet<AuditTrail> AuditTrails { get; set; }


        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // 1. Auth: Khóa kép bảng trung gian UserRole
            modelBuilder.Entity<UserRole>().HasKey(ur => new { ur.UserId, ur.RoleId });

            // 2. Thiết bị - Phần mềm: Khóa kép N-N
            modelBuilder.Entity<ThietBi_PhanMem>().HasKey(tp => new { tp.ThietBiId, tp.PhanMemId });

            // 3. Cấu hình các cột UNIQUE (Tránh trùng mã)
            modelBuilder.Entity<ChiNhanh>().HasIndex(c => c.MaChiNhanh).IsUnique();
            modelBuilder.Entity<NhaCungCap>().HasIndex(n => n.MaNhaCungCap).IsUnique();
            modelBuilder.Entity<LoaiThietBi>().HasIndex(l => l.MaLoai).IsUnique();
            modelBuilder.Entity<PhanMem>().HasIndex(p => p.MaPhanMem).IsUnique();
            modelBuilder.Entity<ThietBi>().HasIndex(t => t.MaMay).IsUnique();
            modelBuilder.Entity<DiaChiIP>().HasIndex(d => d.DiaChi).IsUnique();

            // 4. Quan hệ 1-1 giữa Thiết Bị và Cấu Hình
            modelBuilder.Entity<ThietBi>()
                .HasOne(t => t.CauHinhThietBi)
                .WithOne(c => c.ThietBi)
                .HasForeignKey<CauHinhThietBi>(c => c.ThietBiId);

            // 5. Ngăn lỗi Multiple Cascade Paths (Xóa tự động dây chuyền) của bảng Lịch Sử
            modelBuilder.Entity<LichSuChuyenDoi>()
                .HasOne(ls => ls.MayCu)
                .WithMany(t => t.LichSuTuMayCu)
                .HasForeignKey(ls => ls.IdMayCu)
                .OnDelete(DeleteBehavior.NoAction); // Tắt tự động xóa để khỏi bị xung đột SQL

            modelBuilder.Entity<LichSuChuyenDoi>()
                .HasOne(ls => ls.MayMoi)
                .WithMany(t => t.LichSuDenMayMoi)
                .HasForeignKey(ls => ls.IdMayMoi)
                .OnDelete(DeleteBehavior.NoAction);
        }
    }
}

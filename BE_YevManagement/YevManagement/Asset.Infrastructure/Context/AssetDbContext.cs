using System;
using System.Collections.Generic;
using Asset.Domain;
using Microsoft.EntityFrameworkCore;

namespace Asset.Infrastructure.Context;

public partial class AssetDbContext : DbContext
{
    public AssetDbContext()
    {
    }

    public AssetDbContext(DbContextOptions<AssetDbContext> options)
        : base(options)
    {
    }

    public virtual DbSet<AuditTrail> AuditTrails { get; set; }

    public virtual DbSet<CauHinhThietBi> CauHinhThietBis { get; set; }

    public virtual DbSet<ChiNhanh> ChiNhanhs { get; set; }

    public virtual DbSet<DiaChiIp> DiaChiIps { get; set; }

    public virtual DbSet<LichSuChuyenDoi> LichSuChuyenDois { get; set; }

    public virtual DbSet<LoaiThietBi> LoaiThietBis { get; set; }

    public virtual DbSet<NhaCungCap> NhaCungCaps { get; set; }

    public virtual DbSet<PhanMem> PhanMems { get; set; }

    public virtual DbSet<ThietBi> ThietBis { get; set; }

    public virtual DbSet<ThietBiPhanMem> ThietBiPhanMems { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<AuditTrail>(entity =>
        {
            entity.Property(e => e.Action).HasMaxLength(50);
            entity.Property(e => e.ChangedBy).HasMaxLength(150);
            entity.Property(e => e.TableName).HasMaxLength(100);
        });

        modelBuilder.Entity<CauHinhThietBi>(entity =>
        {
            entity.HasIndex(e => e.ThietBiId, "IX_CauHinhThietBis_ThietBiId").IsUnique();

            entity.Property(e => e.Cpu)
                .HasMaxLength(150)
                .HasColumnName("CPU");
            entity.Property(e => e.GhiChu).HasMaxLength(150);
            entity.Property(e => e.Headphone).HasMaxLength(150);
            entity.Property(e => e.Keyboard).HasMaxLength(150);
            entity.Property(e => e.Mainboard).HasMaxLength(150);
            entity.Property(e => e.Monitor).HasMaxLength(150);
            entity.Property(e => e.Mouse).HasMaxLength(150);
            entity.Property(e => e.Ocung)
                .HasMaxLength(150)
                .HasColumnName("OCung");
            entity.Property(e => e.Os)
                .HasMaxLength(150)
                .HasColumnName("OS");
            entity.Property(e => e.Psu)
                .HasMaxLength(150)
                .HasColumnName("PSU");
            entity.Property(e => e.Ram)
                .HasMaxLength(150)
                .HasColumnName("RAM");
            entity.Property(e => e.Speaker).HasMaxLength(150);
            entity.Property(e => e.Ups)
                .HasMaxLength(150)
                .HasColumnName("UPS");
            entity.Property(e => e.Vga)
                .HasMaxLength(150)
                .HasColumnName("VGA");

            entity.HasOne(d => d.ThietBi).WithOne(p => p.CauHinhThietBi).HasForeignKey<CauHinhThietBi>(d => d.ThietBiId);
        });

        modelBuilder.Entity<ChiNhanh>(entity =>
        {
            entity.HasIndex(e => e.MaChiNhanh, "IX_ChiNhanhs_MaChiNhanh").IsUnique();

            entity.Property(e => e.MaChiNhanh).HasMaxLength(50);
            entity.Property(e => e.TenChiNhanh).HasMaxLength(255);
        });

        modelBuilder.Entity<DiaChiIp>(entity =>
        {
            entity.ToTable("DiaChiIPs");

            entity.HasIndex(e => e.DiaChi, "IX_DiaChiIPs_DiaChi").IsUnique();

            entity.HasIndex(e => e.ThietBiId, "IX_DiaChiIPs_ThietBiId");

            entity.Property(e => e.AlternateDns)
                .HasMaxLength(15)
                .HasColumnName("AlternateDNS");
            entity.Property(e => e.DiaChi).HasMaxLength(25);
            entity.Property(e => e.Gateway).HasMaxLength(15);
            entity.Property(e => e.GhiChu).HasMaxLength(255);
            entity.Property(e => e.PreferredDns)
                .HasMaxLength(15)
                .HasColumnName("PreferredDNS");
            entity.Property(e => e.ServerIp)
                .HasMaxLength(15)
                .HasColumnName("ServerIP");
            entity.Property(e => e.SubnetMask).HasMaxLength(15);

            entity.HasOne(d => d.ThietBi).WithMany(p => p.DiaChiIps).HasForeignKey(d => d.ThietBiId);
        });

        modelBuilder.Entity<LichSuChuyenDoi>(entity =>
        {
            entity.HasIndex(e => e.IdMayCu, "IX_LichSuChuyenDois_IdMayCu");

            entity.HasIndex(e => e.IdMayMoi, "IX_LichSuChuyenDois_IdMayMoi");

            entity.Property(e => e.GhiChu).HasMaxLength(500);

            entity.HasOne(d => d.IdMayCuNavigation).WithMany(p => p.LichSuChuyenDoiIdMayCuNavigations)
                .HasForeignKey(d => d.IdMayCu)
                .OnDelete(DeleteBehavior.ClientSetNull);

            entity.HasOne(d => d.IdMayMoiNavigation).WithMany(p => p.LichSuChuyenDoiIdMayMoiNavigations)
                .HasForeignKey(d => d.IdMayMoi)
                .OnDelete(DeleteBehavior.ClientSetNull);
        });

        modelBuilder.Entity<LoaiThietBi>(entity =>
        {
            entity.HasIndex(e => e.MaLoai, "IX_LoaiThietBis_MaLoai").IsUnique();

            entity.Property(e => e.MaLoai).HasMaxLength(50);
            entity.Property(e => e.TenLoai).HasMaxLength(255);
        });

        modelBuilder.Entity<NhaCungCap>(entity =>
        {
            entity.HasIndex(e => e.MaNhaCungCap, "IX_NhaCungCaps_MaNhaCungCap").IsUnique();

            entity.Property(e => e.MaNhaCungCap).HasMaxLength(50);
            entity.Property(e => e.TenNhaCungCap).HasMaxLength(255);
        });

        modelBuilder.Entity<PhanMem>(entity =>
        {
            entity.HasIndex(e => e.MaPhanMem, "IX_PhanMems_MaPhanMem").IsUnique();

            entity.Property(e => e.MaPhanMem).HasMaxLength(50);
            entity.Property(e => e.NhaPhatHanh).HasMaxLength(150);
            entity.Property(e => e.TenPhanMem).HasMaxLength(255);
        });

        modelBuilder.Entity<ThietBi>(entity =>
        {
            entity.HasIndex(e => e.ChiNhanhId, "IX_ThietBis_ChiNhanhId");

            entity.HasIndex(e => e.LoaiThietBiId, "IX_ThietBis_LoaiThietBiId");

            entity.HasIndex(e => e.MaMay, "IX_ThietBis_MaMay").IsUnique();

            entity.HasIndex(e => e.NhaCungCapId, "IX_ThietBis_NhaCungCapId");

            entity.Property(e => e.Email).HasMaxLength(255);
            entity.Property(e => e.GhiChu).HasMaxLength(500);
            entity.Property(e => e.MaMay).HasMaxLength(50);
            entity.Property(e => e.NguoiQuanLy).HasMaxLength(150);
            entity.Property(e => e.TenMay).HasMaxLength(255);

            entity.HasOne(d => d.ChiNhanh).WithMany(p => p.ThietBis).HasForeignKey(d => d.ChiNhanhId);

            entity.HasOne(d => d.LoaiThietBi).WithMany(p => p.ThietBis).HasForeignKey(d => d.LoaiThietBiId);

            entity.HasOne(d => d.NhaCungCap).WithMany(p => p.ThietBis).HasForeignKey(d => d.NhaCungCapId);
        });

        modelBuilder.Entity<ThietBiPhanMem>(entity =>
        {
            entity.HasKey(e => new { e.ThietBiId, e.PhanMemId });

            entity.ToTable("ThietBi_PhanMems");

            entity.HasIndex(e => e.PhanMemId, "IX_ThietBi_PhanMems_PhanMemId");

            entity.Property(e => e.LicenseKey).HasMaxLength(255);

            entity.HasOne(d => d.PhanMem).WithMany(p => p.ThietBiPhanMems).HasForeignKey(d => d.PhanMemId);

            entity.HasOne(d => d.ThietBi).WithMany(p => p.ThietBiPhanMems).HasForeignKey(d => d.ThietBiId);
        });

        OnModelCreatingPartial(modelBuilder);
    }

    partial void OnModelCreatingPartial(ModelBuilder modelBuilder);
}

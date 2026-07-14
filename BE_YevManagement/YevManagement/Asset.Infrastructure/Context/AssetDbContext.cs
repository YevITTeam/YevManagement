using Asset.Domain.Entities;
using Asset.Domain.Models;
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
    public virtual DbSet<AssetSetting> AssetSettings { get; set; }
    public virtual DbSet<Branch> Branches { get; set; }
    public virtual DbSet<Device> Devices { get; set; }
    public virtual DbSet<DeviceGroup> DeviceGroups { get; set; }
    public virtual DbSet<DeviceDepartment> DeviceDepartments { get; set; }
    public virtual DbSet<DeviceConfiguration> DeviceConfigurations { get; set; }
    public virtual DbSet<DeviceConfigurationInitial> DeviceConfigurationInitials { get; set; }
    public virtual DbSet<DeviceConfigurationHistory> DeviceConfigurationHistories { get; set; }
    public virtual DbSet<DeviceEmail> DeviceEmails { get; set; }
    public virtual DbSet<DeviceSoftware> DeviceSoftwares { get; set; }
    public virtual DbSet<DeviceType> DeviceTypes { get; set; }
    public virtual DbSet<IpAddress> IpAddresses { get; set; }
    public virtual DbSet<IpPrefix> IpPrefixes { get; set; }
    public virtual DbSet<Software> Softwares { get; set; }
    public virtual DbSet<Supplier> Suppliers { get; set; }
    public virtual DbSet<TransferHistory> TransferHistories { get; set; }
    public virtual DbSet<SoftwareGroup> SoftwareGroups { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<AuditTrail>(entity =>
        {
            entity.Property(e => e.Action).HasMaxLength(50);
            entity.Property(e => e.ChangedBy).HasMaxLength(150);
            entity.Property(e => e.TableName).HasMaxLength(100);
        });

        modelBuilder.Entity<AssetSetting>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK_AssetSettings");
        });

        modelBuilder.Entity<Branch>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK_ChiNhanhs");
            entity.HasIndex(e => e.BranchCode, "IX_ChiNhanhs_MaChiNhanh").IsUnique();
            entity.Property(e => e.BranchCode).HasMaxLength(50);
            entity.Property(e => e.BranchName).HasMaxLength(255);
        });

        modelBuilder.Entity<Device>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK_ThietBis");
            entity.HasIndex(e => e.BranchId, "IX_ThietBis_ChiNhanhId");
            entity.HasIndex(e => e.DeviceTypeId, "IX_ThietBis_LoaiThietBiId");
            entity.HasIndex(e => e.DeviceCode, "IX_ThietBis_MaMay").IsUnique();
            entity.HasIndex(e => e.SupplierId, "IX_ThietBis_NhaCungCapId");
            entity.HasIndex(e => e.SerialNumber, "IX_ThietBis_SoSeri").IsUnique().HasFilter("[SerialNumber] IS NOT NULL");

            entity.Property(e => e.DeviceCode).HasMaxLength(50);
            entity.Property(e => e.DeviceName).HasMaxLength(255);
            entity.Property(e => e.Manager).HasMaxLength(150);
            entity.Property(e => e.Note).HasMaxLength(500);
            entity.Property(e => e.SerialNumber).HasMaxLength(100);
            entity.Property(e => e.IsUseUsb).HasDefaultValue(false);

            entity.HasOne(d => d.Branch).WithMany(p => p.Devices)
                .HasForeignKey(d => d.BranchId)
                .HasConstraintName("FK_ThietBis_ChiNhanhs_ChiNhanhId");

            entity.HasOne(d => d.DeviceType).WithMany(p => p.Devices)
                .HasForeignKey(d => d.DeviceTypeId)
                .HasConstraintName("FK_ThietBis_LoaiThietBis_LoaiThietBiId");

            entity.HasOne(d => d.Supplier).WithMany(p => p.Devices)
                .HasForeignKey(d => d.SupplierId)
                .HasConstraintName("FK_ThietBis_NhaCungCaps_NhaCungCapId");

            // Self-reference: gợi ý "máy MỚI nào sẽ thay thế cho máy này" — lưu trên chính máy
            // CŨ (điền từ cột "MQL Cũ" khi import Excel: sau khi tạo máy mới, server ghi Id máy
            // mới vào SuggestedNewDeviceId của máy cũ tương ứng, xem docs/asset-module.md).
            // 2026-07-13: đổi hướng tự tham chiếu — trước đó lưu trên máy MỚI (ReplacesOldDeviceId
            // trỏ về máy cũ), nay lưu trên máy CŨ (trỏ tới máy mới) để màn "Chuyển máy" mở trên
            // máy cũ đọc thẳng 1 cột, không cần dò ngược nhiều máy mới cùng khai là thay thế cho
            // nó. Chỉ mang tính gợi ý cho màn hình "Chuyển máy" — không tự động thực hiện TransferHistory.
            entity.HasIndex(e => e.SuggestedNewDeviceId, "IX_ThietBis_GoiYMayMoiId");

            entity.HasOne(d => d.SuggestedNewDevice).WithMany()
                .HasForeignKey(d => d.SuggestedNewDeviceId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_ThietBis_ThietBis_GoiYMayMoiId");

            // Nhóm/Bộ phận: phân loại "thiết bị đang ở chỗ nào" bên cạnh Branch (chi nhánh).
            // Nullable — dữ liệu thiết bị cũ chưa gán, chỉ bắt buộc dần qua Create/Update mới.
            entity.HasIndex(e => e.GroupId, "IX_ThietBis_NhomId");
            entity.HasIndex(e => e.DepartmentId, "IX_ThietBis_BoPhanId");

            entity.HasOne(d => d.DeviceGroup).WithMany(p => p.Devices)
                .HasForeignKey(d => d.GroupId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_ThietBis_Nhoms_NhomId");

            entity.HasOne(d => d.DeviceDepartment).WithMany(p => p.Devices)
                .HasForeignKey(d => d.DepartmentId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_ThietBis_BoPhans_BoPhanId");
        });

        modelBuilder.Entity<DeviceGroup>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK_Nhoms");
            // 1 Bộ phận - N Nhóm (2026-07-13): mã Nhóm không còn unique toàn cục, chỉ unique
            // trong phạm vi 1 Bộ phận (VD "OF" có thể vừa thuộc Tổng vụ vừa thuộc Quản lý chất
            // lượng, là 2 Nhóm khác nhau).
            entity.HasIndex(e => new { e.DepartmentId, e.GroupCode }, "IX_Nhoms_BoPhanId_MaNhom").IsUnique();
            entity.Property(e => e.GroupCode).HasMaxLength(50);
            entity.Property(e => e.GroupName).HasMaxLength(255);

            entity.HasOne(d => d.Department).WithMany(p => p.DeviceGroups)
                .HasForeignKey(d => d.DepartmentId)
                .HasConstraintName("FK_Nhoms_BoPhans_BoPhanId");
        });

        modelBuilder.Entity<DeviceDepartment>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK_BoPhans");
            entity.HasIndex(e => e.DepartmentCode, "IX_BoPhans_MaBoPhan").IsUnique();
            entity.Property(e => e.DepartmentCode).HasMaxLength(50);
            entity.Property(e => e.DepartmentName).HasMaxLength(255);
        });

        modelBuilder.Entity<DeviceConfiguration>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK_CauHinhThietBis");
            entity.HasIndex(e => e.DeviceId, "IX_CauHinhThietBis_ThietBiId").IsUnique();

            entity.Property(e => e.Cpu).HasMaxLength(150).HasColumnName("CPU");
            entity.Property(e => e.HardDrive).HasMaxLength(150);
            entity.Property(e => e.Headphone).HasMaxLength(150);
            entity.Property(e => e.Keyboard).HasMaxLength(150);
            entity.Property(e => e.Mainboard).HasMaxLength(150);
            entity.Property(e => e.Monitor).HasMaxLength(150);
            entity.Property(e => e.Mouse).HasMaxLength(150);
            entity.Property(e => e.Note).HasMaxLength(150);
            entity.Property(e => e.Os).HasMaxLength(150).HasColumnName("OS");
            entity.Property(e => e.Psu).HasMaxLength(150).HasColumnName("PSU");
            entity.Property(e => e.Ram).HasMaxLength(150).HasColumnName("RAM");
            entity.Property(e => e.Speaker).HasMaxLength(150);
            entity.Property(e => e.Ups).HasMaxLength(150).HasColumnName("UPS");
            entity.Property(e => e.Vga).HasMaxLength(150).HasColumnName("VGA");
            entity.Property(e => e.Maker).HasMaxLength(150);
            entity.Property(e => e.Model).HasMaxLength(150);
            entity.Property(e => e.PowerAdapter).HasMaxLength(150);
            entity.Property(e => e.WirelessCard).HasMaxLength(150);
            entity.Property(e => e.Nic).HasMaxLength(150).HasColumnName("NIC");
            entity.Property(e => e.Other).HasMaxLength(150);

            entity.HasOne(d => d.Device).WithOne(p => p.DeviceConfiguration)
                .HasForeignKey<DeviceConfiguration>(d => d.DeviceId)
                .HasConstraintName("FK_CauHinhThietBis_ThietBis_ThietBiId");
        });

        modelBuilder.Entity<DeviceConfigurationInitial>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK_CauHinhBanDaus");
            entity.HasIndex(e => e.DeviceConfigurationId, "IX_CauHinhBanDaus_CauHinhThietBiId").IsUnique();

            entity.Property(e => e.Cpu).HasMaxLength(150).HasColumnName("CPU");
            entity.Property(e => e.HardDrive).HasMaxLength(150);
            entity.Property(e => e.Headphone).HasMaxLength(150);
            entity.Property(e => e.Keyboard).HasMaxLength(150);
            entity.Property(e => e.Mainboard).HasMaxLength(150);
            entity.Property(e => e.Monitor).HasMaxLength(150);
            entity.Property(e => e.Mouse).HasMaxLength(150);
            entity.Property(e => e.Note).HasMaxLength(150);
            entity.Property(e => e.Os).HasMaxLength(150).HasColumnName("OS");
            entity.Property(e => e.Psu).HasMaxLength(150).HasColumnName("PSU");
            entity.Property(e => e.Ram).HasMaxLength(150).HasColumnName("RAM");
            entity.Property(e => e.Speaker).HasMaxLength(150);
            entity.Property(e => e.Ups).HasMaxLength(150).HasColumnName("UPS");
            entity.Property(e => e.Vga).HasMaxLength(150).HasColumnName("VGA");
            entity.Property(e => e.Maker).HasMaxLength(150);
            entity.Property(e => e.Model).HasMaxLength(150);
            entity.Property(e => e.PowerAdapter).HasMaxLength(150);
            entity.Property(e => e.WirelessCard).HasMaxLength(150);
            entity.Property(e => e.Nic).HasMaxLength(150).HasColumnName("NIC");
            entity.Property(e => e.Other).HasMaxLength(150);

            entity.HasOne(d => d.DeviceConfiguration).WithMany()
                .HasForeignKey(d => d.DeviceConfigurationId)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("FK_CauHinhBanDaus_CauHinhThietBis_CauHinhThietBiId");
        });

        modelBuilder.Entity<DeviceConfigurationHistory>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK_SuaChuaThayThes");
            entity.HasIndex(e => e.DeviceConfigurationId, "IX_SuaChuaThayThes_CauHinhThietBiId");

            entity.Property(e => e.Cpu).HasMaxLength(150).HasColumnName("CPU");
            entity.Property(e => e.HardDrive).HasMaxLength(150);
            entity.Property(e => e.Headphone).HasMaxLength(150);
            entity.Property(e => e.Keyboard).HasMaxLength(150);
            entity.Property(e => e.Mainboard).HasMaxLength(150);
            entity.Property(e => e.Monitor).HasMaxLength(150);
            entity.Property(e => e.Mouse).HasMaxLength(150);
            entity.Property(e => e.Note).HasMaxLength(150);
            entity.Property(e => e.Os).HasMaxLength(150).HasColumnName("OS");
            entity.Property(e => e.Psu).HasMaxLength(150).HasColumnName("PSU");
            entity.Property(e => e.Ram).HasMaxLength(150).HasColumnName("RAM");
            entity.Property(e => e.Speaker).HasMaxLength(150);
            entity.Property(e => e.Ups).HasMaxLength(150).HasColumnName("UPS");
            entity.Property(e => e.Vga).HasMaxLength(150).HasColumnName("VGA");
            entity.Property(e => e.Maker).HasMaxLength(150);
            entity.Property(e => e.Model).HasMaxLength(150);
            entity.Property(e => e.PowerAdapter).HasMaxLength(150);
            entity.Property(e => e.WirelessCard).HasMaxLength(150);
            entity.Property(e => e.Nic).HasMaxLength(150).HasColumnName("NIC");
            entity.Property(e => e.Other).HasMaxLength(150);
            entity.Property(e => e.EditedBy).HasMaxLength(150);

            entity.HasOne(d => d.DeviceConfiguration).WithMany()
                .HasForeignKey(d => d.DeviceConfigurationId)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("FK_SuaChuaThayThes_CauHinhThietBis_CauHinhThietBiId");
        });

        modelBuilder.Entity<DeviceEmail>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK_ThietBi_Emails");
            entity.HasIndex(e => e.DeviceId, "IX_ThietBi_Emails_ThietBiId");

            entity.Property(e => e.Email).HasMaxLength(255).IsRequired();
            entity.Property(e => e.Note).HasMaxLength(255);

            entity.HasOne(d => d.Device).WithMany(p => p.DeviceEmails)
                .HasForeignKey(d => d.DeviceId)
                .HasConstraintName("FK_ThietBi_Emails_ThietBis_ThietBiId");
        });

        modelBuilder.Entity<DeviceSoftware>(entity =>
        {
            entity.HasKey(e => new { e.DeviceId, e.SoftwareId }).HasName("PK_ThietBi_PhanMems");
            entity.HasIndex(e => e.SoftwareId, "IX_ThietBi_PhanMems_PhanMemId");
            entity.Property(e => e.LicenseKey).HasMaxLength(255);

            entity.HasOne(d => d.Device).WithMany(p => p.DeviceSoftwares)
                .HasForeignKey(d => d.DeviceId)
                .HasConstraintName("FK_ThietBi_PhanMems_ThietBis_ThietBiId");

            entity.HasOne(d => d.Software).WithMany(p => p.DeviceSoftwares)
                .HasForeignKey(d => d.SoftwareId)
                .HasConstraintName("FK_ThietBi_PhanMems_PhanMems_PhanMemId");
        });

        modelBuilder.Entity<DeviceType>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK_LoaiThietBis");
            entity.HasIndex(e => e.TypeCode, "IX_LoaiThietBis_MaLoai").IsUnique();
            entity.Property(e => e.TypeCode).HasMaxLength(50);
            entity.Property(e => e.TypeName).HasMaxLength(255);
        });

        modelBuilder.Entity<IpAddress>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK_DiaChiIPs");
            entity.HasIndex(e => e.IpAddress1, "IX_DiaChiIPs_DiaChi").IsUnique();
            entity.HasIndex(e => e.DeviceId, "IX_DiaChiIPs_ThietBiId");
            entity.HasIndex(e => e.IpPrefixId, "IX_DiaChiIPs_TienToId");

            entity.Property(e => e.IpAddress1).HasMaxLength(25).HasColumnName("IpAddress");
            entity.Property(e => e.Note).HasMaxLength(255);

            entity.HasOne(d => d.Device).WithMany(p => p.IpAddresses)
                .HasForeignKey(d => d.DeviceId)
                .HasConstraintName("FK_DiaChiIPs_ThietBis_ThietBiId");

            entity.HasOne(d => d.IpPrefix).WithMany(p => p.IpAddresses)
                .HasForeignKey(d => d.IpPrefixId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("FK_DiaChiIPs_TienToIPs_TienToId");
        });

        modelBuilder.Entity<IpPrefix>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK_TienToIPs");
            entity.HasIndex(e => e.Prefix, "IX_TienToIPs_TienTo").IsUnique();
            entity.HasIndex(e => e.BranchId, "IX_TienToIPs_ChiNhanhId");

            entity.Property(e => e.Prefix).HasMaxLength(15);
            entity.Property(e => e.SubnetMask).HasMaxLength(15);
            entity.Property(e => e.Gateway).HasMaxLength(15);
            entity.Property(e => e.PreferredDns).HasMaxLength(15).HasColumnName("PreferredDNS");
            entity.Property(e => e.AlternateDns).HasMaxLength(15).HasColumnName("AlternateDNS");
            entity.Property(e => e.Description).HasMaxLength(255);

            entity.HasOne(d => d.Branch).WithMany(p => p.IpPrefixes)
                .HasForeignKey(d => d.BranchId)
                .HasConstraintName("FK_TienToIPs_ChiNhanhs_ChiNhanhId");
        });

        modelBuilder.Entity<Supplier>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK_NhaCungCaps");
            entity.HasIndex(e => e.SupplierCode, "IX_NhaCungCaps_MaNhaCungCap").IsUnique();
            entity.Property(e => e.SupplierCode).HasMaxLength(50);
            entity.Property(e => e.SupplierName).HasMaxLength(255);
        });

        modelBuilder.Entity<TransferHistory>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK_LichSuChuyenDois");
            entity.HasIndex(e => e.OldDeviceId, "IX_LichSuChuyenDois_IdMayCu");
            entity.HasIndex(e => e.NewDeviceId, "IX_LichSuChuyenDois_IdMayMoi");
            entity.Property(e => e.Note).HasMaxLength(500);

            entity.HasOne(d => d.NewDevice).WithMany(p => p.TransferHistoryNewDevices)
                .HasForeignKey(d => d.NewDeviceId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_LichSuChuyenDois_ThietBis_IdMayMoi");

            entity.HasOne(d => d.OldDevice).WithMany(p => p.TransferHistoryOldDevices)
                .HasForeignKey(d => d.OldDeviceId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_LichSuChuyenDois_ThietBis_IdMayCu");
        });

        modelBuilder.Entity<SoftwareGroup>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK_NhomPhanMems");
            entity.HasIndex(e => e.GroupCode, "IX_NhomPhanMems_MaNhom").IsUnique();

            entity.Property(e => e.GroupCode).HasMaxLength(50).IsRequired();
            entity.Property(e => e.GroupName).HasMaxLength(255).IsRequired();
        });

        modelBuilder.Entity<Software>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK_PhanMems");
            entity.HasIndex(e => e.SoftwareCode, "IX_PhanMems_MaPhanMem").IsUnique();

            entity.HasIndex(e => e.SoftwareGroupId, "IX_PhanMems_NhomPhanMemId");

            entity.Property(e => e.Publisher).HasMaxLength(255);
            entity.Property(e => e.SoftwareCode).HasMaxLength(50).IsRequired();
            entity.Property(e => e.SoftwareName).HasMaxLength(255).IsRequired();
            entity.Property(e => e.SoftwareType).HasMaxLength(150);

            entity.HasOne(d => d.SoftwareGroup)
                  .WithMany(p => p.Softwares)
                  .HasForeignKey(d => d.SoftwareGroupId)
                  .OnDelete(DeleteBehavior.Restrict)
                  .HasConstraintName("FK_PhanMems_NhomPhanMems_NhomPhanMemId");
        });

        OnModelCreatingPartial(modelBuilder);
    }

    partial void OnModelCreatingPartial(ModelBuilder modelBuilder);
}
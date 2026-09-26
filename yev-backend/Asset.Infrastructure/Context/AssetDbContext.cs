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
    public virtual DbSet<ServerCheckSession> ServerCheckSessions { get; set; }
    public virtual DbSet<ServerCheckItem> ServerCheckItems { get; set; }
    public virtual DbSet<ServerCheckManualItem> ServerCheckManualItems { get; set; }
    public virtual DbSet<ServerCheckManualResult> ServerCheckManualResults { get; set; }
    public virtual DbSet<ServerCheckAssignment> ServerCheckAssignments { get; set; }
    public virtual DbSet<InventorySession> InventorySessions { get; set; }
    public virtual DbSet<InventorySessionItem> InventorySessionItems { get; set; }
    public virtual DbSet<InventoryAssignment> InventoryAssignments { get; set; }
    public virtual DbSet<AppRelease> AppReleases { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<AuditTrail>(entity =>
        {
            entity.Property(e => e.Action).HasMaxLength(50);
            entity.Property(e => e.ChangedBy).HasMaxLength(150);
            entity.Property(e => e.TableName).HasMaxLength(100);
            entity.Property(e => e.RecordName).HasMaxLength(255);
            entity.Property(e => e.AffectedCount).HasDefaultValue(1);
            entity.HasIndex(e => new { e.TableName, e.RecordId }, "IX_AuditTrails_TableName_RecordId");
            entity.HasIndex(e => e.ChangedAt, "IX_AuditTrails_ChangedAt");
        });

        modelBuilder.Entity<AssetSetting>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK_AssetSettings");

            entity.HasOne(d => d.ServerCheckBranch).WithMany()
                .HasForeignKey(d => d.ServerCheckBranchId)
                .HasConstraintName("FK_AssetSettings_Branches_ServerCheckBranchId")
                .OnDelete(DeleteBehavior.SetNull);
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
            entity.Property(e => e.RequiresDailyCheck).HasDefaultValue(false);

            entity.HasOne(d => d.Branch).WithMany(p => p.Devices)
                .HasForeignKey(d => d.BranchId)
                .HasConstraintName("FK_ThietBis_ChiNhanhs_ChiNhanhId");

            entity.HasOne(d => d.DeviceType).WithMany(p => p.Devices)
                .HasForeignKey(d => d.DeviceTypeId)
                .HasConstraintName("FK_ThietBis_LoaiThietBis_LoaiThietBiId");

            entity.HasOne(d => d.Supplier).WithMany(p => p.Devices)
                .HasForeignKey(d => d.SupplierId)
                .HasConstraintName("FK_ThietBis_NhaCungCaps_NhaCungCapId");

            // Self-reference: suggestion for "which NEW device will replace this device" — stored on the
            // OLD device itself (populated from the "Old MQL" column when importing Excel: after creating
            // the new device, the server writes the new device's Id into SuggestedNewDeviceId of the
            // corresponding old device, see docs/asset-module.md).
            // 2026-07-13: reversed the self-reference direction — previously stored on the NEW device
            // (ReplacesOldDeviceId pointing to the old device), now stored on the OLD device (pointing to
            // the new device) so the "Transfer Device" screen opened on the old device can read a single
            // column directly, without having to search backward through multiple new devices claiming to
            // replace it. This is only a suggestion for the "Transfer Device" screen — it does not
            // automatically create a TransferHistory record.
            entity.HasIndex(e => e.SuggestedNewDeviceId, "IX_ThietBis_GoiYMayMoiId");

            entity.HasOne(d => d.SuggestedNewDevice).WithMany()
                .HasForeignKey(d => d.SuggestedNewDeviceId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_ThietBis_ThietBis_GoiYMayMoiId");

            // Group/Department: classifies "where the device is located" alongside Branch.
            // Nullable — existing devices are not yet assigned; it is only gradually enforced via new Create/Update.
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
            // 1 Department - N Groups (2026-07-13): Group code is no longer globally unique, only unique
            // within 1 Department (e.g. "OF" can belong to both General Affairs and Quality Management,
            // as 2 distinct Groups).
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
            entity.Property(e => e.RequiresQrScan).HasDefaultValue(false);
        });

        modelBuilder.Entity<ServerCheckSession>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK_ServerCheckSessions");
            entity.HasIndex(e => new { e.CheckDate, e.BranchId }, "IX_ServerCheckSessions_CheckDate_BranchId").IsUnique();
            entity.Property(e => e.StartedBy).HasMaxLength(150);
            entity.Property(e => e.EndedBy).HasMaxLength(150);

            entity.HasOne(d => d.Branch).WithMany()
                .HasForeignKey(d => d.BranchId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("FK_ServerCheckSessions_Branches_BranchId");
        });

        modelBuilder.Entity<ServerCheckAssignment>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK_ServerCheckAssignments");
            entity.HasIndex(e => e.UserId, "IX_ServerCheckAssignments_UserId").IsUnique();
            entity.Property(e => e.UserName).HasMaxLength(150);
            entity.Property(e => e.FullName).HasMaxLength(150);

            entity.HasOne(d => d.Branch).WithMany()
                .HasForeignKey(d => d.BranchId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("FK_ServerCheckAssignments_Branches_BranchId");
        });

        modelBuilder.Entity<InventorySession>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK_InventorySessions");
            // Chỉ ràng buộc DB: 1 xưởng không được có quá 1 phiên InProgress (Status=0) cùng lúc — filtered
            // unique index vì nhiều phiên Completed của cùng xưởng là bình thường (mỗi đợt kiểm kê 1 phiên).
            entity.HasIndex(e => e.BranchId, "IX_InventorySessions_BranchId_InProgress")
                .IsUnique()
                .HasFilter("[Status] = 0");
            entity.Property(e => e.StartedBy).HasMaxLength(150);
            entity.Property(e => e.EndedBy).HasMaxLength(150);

            entity.HasOne(d => d.Branch).WithMany()
                .HasForeignKey(d => d.BranchId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("FK_InventorySessions_Branches_BranchId");
        });

        modelBuilder.Entity<InventorySessionItem>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK_InventorySessionItems");
            entity.HasIndex(e => e.SessionId, "IX_InventorySessionItems_SessionId");
            entity.HasIndex(e => e.DeviceId, "IX_InventorySessionItems_DeviceId");
            entity.Property(e => e.ScannedBy).HasMaxLength(150);
            entity.Property(e => e.Note).HasMaxLength(500);

            entity.HasOne(d => d.Session).WithMany(p => p.Items)
                .HasForeignKey(d => d.SessionId)
                .HasConstraintName("FK_InventorySessionItems_InventorySessions_SessionId");

            entity.HasOne(d => d.Device).WithMany()
                .HasForeignKey(d => d.DeviceId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("FK_InventorySessionItems_ThietBis_DeviceId");
        });

        modelBuilder.Entity<InventoryAssignment>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK_InventoryAssignments");
            entity.HasIndex(e => e.UserId, "IX_InventoryAssignments_UserId").IsUnique();
            entity.Property(e => e.UserName).HasMaxLength(150);
            entity.Property(e => e.FullName).HasMaxLength(150);

            entity.HasOne(d => d.Branch).WithMany()
                .HasForeignKey(d => d.BranchId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("FK_InventoryAssignments_Branches_BranchId");
        });

        modelBuilder.Entity<AppRelease>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK_AppReleases");
            entity.HasIndex(e => e.VersionCode, "IX_AppReleases_VersionCode").IsUnique();
            entity.Property(e => e.VersionName).HasMaxLength(50);
            entity.Property(e => e.ApkUrl).HasMaxLength(500);
            entity.Property(e => e.Changelog).HasColumnType("nvarchar(max)");
        });

        modelBuilder.Entity<ServerCheckItem>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK_ServerCheckItems");
            entity.HasIndex(e => e.SessionId, "IX_ServerCheckItems_SessionId");
            entity.HasIndex(e => e.DeviceId, "IX_ServerCheckItems_DeviceId");
            entity.Property(e => e.ScannedBy).HasMaxLength(150);
            entity.Property(e => e.Note).HasMaxLength(500);

            entity.HasOne(d => d.Session).WithMany(p => p.Items)
                .HasForeignKey(d => d.SessionId)
                .HasConstraintName("FK_ServerCheckItems_ServerCheckSessions_SessionId");

            entity.HasOne(d => d.Device).WithMany()
                .HasForeignKey(d => d.DeviceId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("FK_ServerCheckItems_ThietBis_DeviceId");
        });

        modelBuilder.Entity<ServerCheckManualItem>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK_ServerCheckManualItems");
            entity.Property(e => e.Name).HasMaxLength(255);
            entity.Property(e => e.UsesNetworkPing).HasDefaultValue(false);
            entity.Property(e => e.IsAirConditioner).HasDefaultValue(false);
        });

        modelBuilder.Entity<ServerCheckManualResult>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK_ServerCheckManualResults");
            entity.HasIndex(e => e.SessionId, "IX_ServerCheckManualResults_SessionId");
            entity.HasIndex(e => new { e.SessionId, e.ManualItemId }, "IX_ServerCheckManualResults_SessionId_ManualItemId").IsUnique();
            entity.Property(e => e.Note).HasMaxLength(500);
            entity.Property(e => e.ConfirmedBy).HasMaxLength(150);

            entity.HasOne(d => d.Session).WithMany(p => p.ManualResults)
                .HasForeignKey(d => d.SessionId)
                .HasConstraintName("FK_ServerCheckManualResults_ServerCheckSessions_SessionId");

            entity.HasOne(d => d.ManualItem).WithMany(p => p.Results)
                .HasForeignKey(d => d.ManualItemId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("FK_ServerCheckManualResults_ServerCheckManualItems_ManualItemId");
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
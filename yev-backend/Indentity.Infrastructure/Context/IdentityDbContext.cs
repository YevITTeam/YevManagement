using System;
using System.Collections.Generic;
using Identity.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Identity.Infrastructure.Context;

public partial class IdentityDbContext : DbContext
{
    public IdentityDbContext()
    {
    }

    public IdentityDbContext(DbContextOptions<IdentityDbContext> options)
        : base(options)
    {
    }

    public virtual DbSet<Role> Roles { get; set; }

    public virtual DbSet<User> Users { get; set; }

    public virtual DbSet<LoginUserIP> LoginUserIPs { get; set; }

    public virtual DbSet<Permission> Permissions { get; set; }

    public virtual DbSet<UserPermission> UserPermissions { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Role>(entity =>
        {
            entity.Property(e => e.RoleName).HasMaxLength(50);

            entity.HasMany(d => d.Permissions).WithMany(p => p.Roles)
                .UsingEntity<Dictionary<string, object>>(
                    "RolePermission",
                    r => r.HasOne<Permission>().WithMany().HasForeignKey("PermissionId"),
                    l => l.HasOne<Role>().WithMany().HasForeignKey("RoleId"),
                    j =>
                    {
                        j.HasKey("RoleId", "PermissionId");
                        j.ToTable("RolePermissions");
                    });
        });

        modelBuilder.Entity<Permission>(entity =>
        {
            entity.Property(e => e.Code).HasMaxLength(150);
            entity.Property(e => e.Module).HasMaxLength(50);
            entity.Property(e => e.Description).HasMaxLength(255);
            entity.HasIndex(e => e.Code).IsUnique();
        });

        modelBuilder.Entity<User>(entity =>
        {
            entity.Property(e => e.DeviceName).HasMaxLength(100);
            entity.Property(e => e.UserName).HasMaxLength(100);
            entity.Property(e => e.Email).HasMaxLength(255);

            entity.HasMany(d => d.Roles).WithMany(p => p.Users)
                .UsingEntity<Dictionary<string, object>>(
                    "UserRole",
                    r => r.HasOne<Role>().WithMany().HasForeignKey("RoleId"),
                    l => l.HasOne<User>().WithMany().HasForeignKey("UserId"),
                    j =>
                    {
                        j.HasKey("UserId", "RoleId");
                        j.ToTable("UserRoles");
                    });
        });

        modelBuilder.Entity<UserPermission>(entity =>
        {
            entity.HasKey(e => new { e.UserId, e.PermissionId });

            entity.Property(e => e.IsAutoGranted).HasDefaultValue(false);

            entity.HasOne(e => e.User).WithMany(u => u.UserPermissions)
                .HasForeignKey(e => e.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(e => e.Permission).WithMany()
                .HasForeignKey(e => e.PermissionId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        OnModelCreatingPartial(modelBuilder);
    }

    partial void OnModelCreatingPartial(ModelBuilder modelBuilder);
}

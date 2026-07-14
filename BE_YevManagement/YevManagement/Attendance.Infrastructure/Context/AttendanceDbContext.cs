using Attendance.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Attendance.Infrastructure.Context;

public partial class AttendanceDbContext : DbContext
{
    public AttendanceDbContext()
    {
    }

    public AttendanceDbContext(DbContextOptions<AttendanceDbContext> options)
        : base(options)
    {
    }

    public virtual DbSet<Department> Departments { get; set; }
    public virtual DbSet<Area> Areas { get; set; }
    public virtual DbSet<Line> Lines { get; set; }
    public virtual DbSet<Group> Groups { get; set; }
    public virtual DbSet<Reason> Reasons { get; set; }
    public virtual DbSet<OtCase> OtCases { get; set; }
    public virtual DbSet<Employee> Employees { get; set; }
    public virtual DbSet<OtForm> OtForms { get; set; }
    public virtual DbSet<OtFormEmployee> OtFormEmployees { get; set; }
    public virtual DbSet<ProcessPart> ProcessParts { get; set; }
    public virtual DbSet<UserApprovalScope> UserApprovalScopes { get; set; }
    public virtual DbSet<OtFormApprovalHistory> OtFormApprovalHistories { get; set; }
    public virtual DbSet<UserSignature> UserSignatures { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Department>(entity =>
        {
            entity.HasIndex(e => e.DepartmentCode, "IX_Departments_DepartmentCode").IsUnique();
            entity.Property(e => e.DepartmentCode).HasMaxLength(50);
            entity.Property(e => e.DepartmentNameVn).HasMaxLength(255);
            entity.Property(e => e.DepartmentNameJp).HasMaxLength(255);
        });

        modelBuilder.Entity<Area>(entity =>
        {
            entity.HasIndex(e => e.AreaCode, "IX_Areas_AreaCode").IsUnique();
            entity.Property(e => e.AreaCode).HasMaxLength(50);
            entity.Property(e => e.AreaName).HasMaxLength(255);
            entity.Property(e => e.AreaDescription).HasMaxLength(500);
        });

        modelBuilder.Entity<Line>(entity =>
        {
            entity.HasIndex(e => e.LineCode, "IX_Lines_LineCode").IsUnique();
            entity.Property(e => e.LineCode).HasMaxLength(50);
            entity.Property(e => e.LineNameVn).HasMaxLength(255);
            entity.Property(e => e.LineNameJp).HasMaxLength(255);
        });

        modelBuilder.Entity<Group>(entity =>
        {
            entity.HasIndex(e => e.GroupCode, "IX_Groups_GroupCode").IsUnique();
            entity.Property(e => e.GroupCode).HasMaxLength(50);
            entity.Property(e => e.GroupNameVn).HasMaxLength(255);
            entity.Property(e => e.GroupNameJp).HasMaxLength(255);
        });

        modelBuilder.Entity<Reason>(entity =>
        {
            entity.Property(e => e.ReasonNameVn).HasMaxLength(255);
            entity.Property(e => e.ReasonNameJp).HasMaxLength(255);
        });

        modelBuilder.Entity<OtCase>(entity =>
        {
            entity.HasIndex(e => e.Code, "IX_OtCases_Code").IsUnique();
            entity.Property(e => e.Code).HasMaxLength(50);
            entity.Property(e => e.Description).HasMaxLength(500);
        });

        modelBuilder.Entity<Employee>(entity =>
        {
            entity.HasIndex(e => e.Code, "IX_Employees_Code").IsUnique();
            entity.Property(e => e.Code).HasMaxLength(50);
            entity.Property(e => e.FirstName).HasMaxLength(150);
            entity.Property(e => e.LastName).HasMaxLength(150);
            entity.Property(e => e.MonthToDate).HasPrecision(10, 2);
            entity.Property(e => e.YearToDate).HasPrecision(10, 2);
        });

        modelBuilder.Entity<OtForm>(entity =>
        {
            entity.HasIndex(e => e.AreaId, "IX_OtForms_AreaId");
            entity.HasIndex(e => e.LineId, "IX_OtForms_LineId");
            entity.HasIndex(e => e.GroupId, "IX_OtForms_GroupId");
            entity.HasIndex(e => e.DepartmentId, "IX_OtForms_DepartmentId");
            entity.HasIndex(e => e.ReasonId, "IX_OtForms_ReasonId");
            entity.HasIndex(e => e.OtCaseId, "IX_OtForms_OtCaseId");
            entity.HasIndex(e => e.CreatedByUserId, "IX_OtForms_CreatedByUserId");
            entity.HasIndex(e => e.Status, "IX_OtForms_Status");

            entity.Property(e => e.SubReason).HasMaxLength(500);
            entity.Property(e => e.TotalHour).HasPrecision(10, 2);

            entity.HasOne(d => d.Area).WithMany(p => p.OtForms)
                .HasForeignKey(d => d.AreaId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("FK_OtForms_Areas_AreaId");

            entity.HasOne(d => d.Line).WithMany(p => p.OtForms)
                .HasForeignKey(d => d.LineId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("FK_OtForms_Lines_LineId");

            entity.HasOne(d => d.Group).WithMany(p => p.OtForms)
                .HasForeignKey(d => d.GroupId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("FK_OtForms_Groups_GroupId");

            entity.HasOne(d => d.Department).WithMany(p => p.OtForms)
                .HasForeignKey(d => d.DepartmentId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("FK_OtForms_Departments_DepartmentId");

            entity.HasOne(d => d.Reason).WithMany(p => p.OtForms)
                .HasForeignKey(d => d.ReasonId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("FK_OtForms_Reasons_ReasonId");

            entity.HasOne(d => d.OtCase).WithMany(p => p.OtForms)
                .HasForeignKey(d => d.OtCaseId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("FK_OtForms_OtCases_OtCaseId");
        });

        modelBuilder.Entity<OtFormEmployee>(entity =>
        {
            entity.HasKey(e => new { e.OtFormId, e.EmployeeId }).HasName("PK_OtFormEmployees");
            entity.HasIndex(e => e.EmployeeId, "IX_OtFormEmployees_EmployeeId");

            entity.Property(e => e.NoteVn).HasMaxLength(500);
            entity.Property(e => e.NoteJp).HasMaxLength(500);

            entity.HasOne(d => d.OtForm).WithMany(p => p.OtFormEmployees)
                .HasForeignKey(d => d.OtFormId)
                .HasConstraintName("FK_OtFormEmployees_OtForms_OtFormId");

            entity.HasOne(d => d.Employee).WithMany(p => p.OtFormEmployees)
                .HasForeignKey(d => d.EmployeeId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("FK_OtFormEmployees_Employees_EmployeeId");
        });

        modelBuilder.Entity<ProcessPart>(entity =>
        {
            entity.HasIndex(e => e.OtFormId, "IX_ProcessParts_OtFormId").IsUnique();
            entity.Property(e => e.AnotherSuggestionVn).HasMaxLength(500);
            entity.Property(e => e.AnotherSuggestionJp).HasMaxLength(500);

            entity.HasOne(d => d.OtForm).WithOne(p => p.ProcessPart)
                .HasForeignKey<ProcessPart>(d => d.OtFormId)
                .HasConstraintName("FK_ProcessParts_OtForms_OtFormId");
        });

        modelBuilder.Entity<UserApprovalScope>(entity =>
        {
            entity.HasIndex(e => new { e.ScopeType, e.ScopeId }, "IX_UserApprovalScopes_ScopeType_ScopeId");
            entity.HasIndex(e => e.UserId, "IX_UserApprovalScopes_UserId");
        });

        modelBuilder.Entity<OtFormApprovalHistory>(entity =>
        {
            entity.HasIndex(e => e.OtFormId, "IX_OtFormApprovalHistories_OtFormId");
            entity.HasIndex(e => e.ApproverUserId, "IX_OtFormApprovalHistories_ApproverUserId");

            entity.Property(e => e.Comment).HasMaxLength(500);

            entity.HasOne(d => d.OtForm).WithMany(p => p.OtFormApprovalHistories)
                .HasForeignKey(d => d.OtFormId)
                .HasConstraintName("FK_OtFormApprovalHistories_OtForms_OtFormId");
        });

        modelBuilder.Entity<UserSignature>(entity =>
        {
            entity.HasIndex(e => e.UserId, "IX_UserSignatures_UserId").IsUnique();
        });

        OnModelCreatingPartial(modelBuilder);
    }

    partial void OnModelCreatingPartial(ModelBuilder modelBuilder);
}

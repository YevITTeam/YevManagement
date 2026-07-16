using System.Text.Json;
using Asset.Domain.Entities;
using Asset.Domain.Models;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.Extensions.Logging;

namespace Asset.Infrastructure.Context;

// Tự động ghi AuditTrail cho mọi Create/Update/Delete đi qua AssetDbContext, chặn tại 1 điểm
// duy nhất (SaveChangesAsync) thay vì sửa tay từng Service — entity mới thêm sau này tự động
// được audit, không cần nhớ gọi thêm gì (2026-07-16).
public partial class AssetDbContext
{
    private readonly IHttpContextAccessor? _auditHttpContextAccessor;
    private readonly ILogger<AssetDbContext>? _auditLogger;

    // Bảng tự thân là log/snapshot rồi (đã có audit riêng) — không audit lồng audit.
    private static readonly HashSet<Type> AuditExcludedTypes = new()
    {
        typeof(AuditTrail),
        typeof(DeviceConfigurationHistory),
        typeof(DeviceConfigurationInitial)
    };

    public AssetDbContext(
        DbContextOptions<AssetDbContext> options,
        IHttpContextAccessor httpContextAccessor,
        ILogger<AssetDbContext> logger) : base(options)
    {
        _auditHttpContextAccessor = httpContextAccessor;
        _auditLogger = logger;
    }

    public override async Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        ChangeTracker.DetectChanges();

        var pendingCreates = new List<EntityEntry>();
        var readyAudits = new List<AuditTrail>();

        foreach (var entry in ChangeTracker.Entries())
        {
            if (entry.State is EntityState.Unchanged or EntityState.Detached) continue;
            if (AuditExcludedTypes.Contains(entry.Entity.GetType())) continue;

            switch (entry.State)
            {
                case EntityState.Added:
                    pendingCreates.Add(entry);
                    break;

                case EntityState.Modified:
                    var (oldValues, newValues) = DiffModifiedProperties(entry);
                    if (oldValues.Count == 0) break; // Update() gọi nhưng không đổi field nào thật
                    readyAudits.Add(BuildAuditTrail(entry, DetectModifiedAction(entry), oldValues, newValues, useOriginalForRecordId: false));
                    break;

                case EntityState.Deleted:
                    var deletedValues = entry.Properties.ToDictionary(p => p.Metadata.Name, p => p.OriginalValue);
                    readyAudits.Add(BuildAuditTrail(entry, "Delete", deletedValues, null, useOriginalForRecordId: true));
                    break;
            }
        }

        // Save nghiệp vụ chính trước — Added entries mới có Id (identity) sau bước này.
        var result = await base.SaveChangesAsync(cancellationToken);

        foreach (var entry in pendingCreates)
        {
            var newValues = entry.Properties.ToDictionary(p => p.Metadata.Name, p => p.CurrentValue);
            readyAudits.Add(BuildAuditTrail(entry, "Create", null, newValues, useOriginalForRecordId: false));
        }

        if (readyAudits.Count > 0)
        {
            try
            {
                AuditTrails.AddRange(readyAudits);
                await base.SaveChangesAsync(cancellationToken);
            }
            catch (Exception ex)
            {
                // Audit log là best-effort: lỗi ghi log không được làm mất dữ liệu nghiệp vụ
                // chính đã lưu thành công ở bước base.SaveChangesAsync phía trên.
                _auditLogger?.LogError(ex, "Ghi AuditTrail thất bại sau khi lưu dữ liệu chính.");
            }
        }

        return result;
    }

    private static (Dictionary<string, object?> oldValues, Dictionary<string, object?> newValues) DiffModifiedProperties(EntityEntry entry)
    {
        var oldValues = new Dictionary<string, object?>();
        var newValues = new Dictionary<string, object?>();

        foreach (var property in entry.Properties)
        {
            if (Equals(property.OriginalValue, property.CurrentValue)) continue;
            oldValues[property.Metadata.Name] = property.OriginalValue;
            newValues[property.Metadata.Name] = property.CurrentValue;
        }

        return (oldValues, newValues);
    }

    // Xoá mềm (IsDeleted false->true) và khôi phục (true->false) đi qua state Modified giống
    // Update thường — phải tự suy Action đúng dựa trên field IsDeleted thay vì gọi chung "Update".
    private static string DetectModifiedAction(EntityEntry entry)
    {
        var isDeletedProperty = entry.Properties.FirstOrDefault(p => p.Metadata.Name == "IsDeleted");
        if (isDeletedProperty == null) return "Update";

        var wasDeleted = isDeletedProperty.OriginalValue is true;
        var isDeleted = isDeletedProperty.CurrentValue is true;

        if (!wasDeleted && isDeleted) return "Delete";
        if (wasDeleted && !isDeleted) return "Restore";
        return "Update";
    }

    private AuditTrail BuildAuditTrail(
        EntityEntry entry,
        string action,
        Dictionary<string, object?>? oldValues,
        Dictionary<string, object?>? newValues,
        bool useOriginalForRecordId)
    {
        // Entity khoá kép (vd DeviceSoftware: DeviceId+SoftwareId) chỉ có 1 cột int đại diện
        // trong AuditTrail.RecordId -> lấy cột khoá đầu tiên, phần còn lại vẫn nằm trong
        // Old/NewValues nên không mất thông tin.
        var pkProperty = entry.Metadata.FindPrimaryKey()!.Properties[0];
        var pkValue = useOriginalForRecordId
            ? entry.Property(pkProperty.Name).OriginalValue
            : entry.Property(pkProperty.Name).CurrentValue;

        return new AuditTrail
        {
            TableName = entry.Entity.GetType().Name,
            RecordId = pkValue is null ? 0 : Convert.ToInt32(pkValue),
            Action = action,
            OldValues = oldValues is { Count: > 0 } ? JsonSerializer.Serialize(oldValues) : null,
            NewValues = newValues is { Count: > 0 } ? JsonSerializer.Serialize(newValues) : null,
            ChangedBy = _auditHttpContextAccessor?.HttpContext?.User?.Identity?.Name ?? "System",
            ChangedAt = DateTime.UtcNow.AddHours(7)
        };
    }
}

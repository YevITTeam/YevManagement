using System.Text.Json;
using Asset.Domain.Entities;
using Asset.Domain.Models;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.Extensions.Logging;

namespace Asset.Infrastructure.Context;

// Automatically records an AuditTrail for every Create/Update/Delete that goes through AssetDbContext,
// intercepted at a single point (SaveChangesAsync) instead of manually editing each Service — any new
// entity added later is audited automatically, no need to remember to call anything extra (2026-07-16).
public partial class AssetDbContext
{
    private readonly IHttpContextAccessor? _auditHttpContextAccessor;
    private readonly ILogger<AssetDbContext>? _auditLogger;

    // These tables are themselves logs/snapshots (already their own audit) — avoid nesting audit inside audit.
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
                    if (oldValues.Count == 0) break; // Update() was called but no field actually changed
                    readyAudits.Add(BuildAuditTrail(entry, DetectModifiedAction(entry), oldValues, newValues, useOriginalForRecordId: false));
                    break;

                case EntityState.Deleted:
                    var deletedValues = entry.Properties.ToDictionary(p => p.Metadata.Name, p => p.OriginalValue);
                    readyAudits.Add(BuildAuditTrail(entry, "Delete", deletedValues, null, useOriginalForRecordId: true));
                    break;
            }
        }

        // Save the main business data first — Added entries only get their Id (identity) after this step.
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
                // Audit logging is best-effort: a logging failure must not lose the main business data
                // that was already saved successfully in the base.SaveChangesAsync step above.
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

    // Soft delete (IsDeleted false->true) and restore (true->false) both go through the Modified state
    // just like a regular Update — the correct Action must be inferred from the IsDeleted field
    // instead of just calling it "Update".
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
        // Entities with a composite key (e.g. DeviceSoftware: DeviceId+SoftwareId) only get 1 int
        // column represented in AuditTrail.RecordId -> take the first key column; the rest still
        // remains in Old/NewValues so no information is lost.
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

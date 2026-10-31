namespace Asset.Domain.Enums;

// Pending = snapshotted, not scanned yet. Ok = scanned. Ng = still unscanned at session end, Note from the checklist.
public enum ServerCheckItemStatus
{
    Pending = 0,
    Ok = 1,
    Ng = 2
}

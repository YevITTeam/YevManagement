namespace Asset.Domain.Enums;

// Pending = snapshotted at session start, not scanned yet. Ok = scanned during the session. Ng = still
// unscanned when the session ended, with Note filled in from the end-session checklist (§2 of
// asset-module.md — AGENTS.md §2 luật 2 decision).
public enum ServerCheckItemStatus
{
    Pending = 0,
    Ok = 1,
    Ng = 2
}

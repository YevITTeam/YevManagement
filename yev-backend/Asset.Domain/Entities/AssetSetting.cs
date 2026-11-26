namespace Asset.Domain.Entities;

// Always exactly 1 row (Id=1), edited via API so Admin changes apply without redeploying.
public partial class AssetSetting
{
    public int Id { get; set; }

    // Months between DeviceLiquidationBackgroundService's auto soft-delete sweeps of Liquidated devices.
    public int LiquidationAfterMonths { get; set; }

    // Not exposed via API; written by the background service. Null = never run (due immediately).
    public DateTime? LastAutoDeleteRunAt { get; set; }

    // The single branch (server room) the ServerCheck feature applies to; without it every branch's devices
    // get snapshotted. Null = no branch filter (escape hatch only).
    public int? ServerCheckBranchId { get; set; }

    // UsbBlockMode. Enforce only locks the machines in UsbEnforceMachines (empty = all); the rest run as Audit.
    public int UsbBlockMode { get; set; }

    // Machine names or device codes, one per line or comma separated.
    public string? UsbEnforceMachines { get; set; }

    // Agents log files copied from a plugged USB onto the PC's fixed drives (a size + timestamp guess).
    public bool UsbTrackCopyIn { get; set; }

    // "iterations.saltBase64.hashBase64" (PBKDF2-SHA256) the agent asks for before an uninstall; null = no password.
    public string? UsbUninstallPasswordHash { get; set; }

    // UsbAgentRelease.Version agents should run; null = no automatic update.
    public string? UsbAgentTargetVersion { get; set; }

    // Machines that take TargetVersion first (same format as UsbEnforceMachines); empty = every agent.
    public string? UsbAgentUpdateMachines { get; set; }

    // Seconds between agent syncs (agents 1.4+), i.e. how fast approvals and mode changes reach PCs. DB default 60.
    public int UsbAgentSyncSeconds { get; set; }

    // Agents whose last event is Uninstalled leave the agent list after this many days; null = keep them.
    public int? UsbAgentPurgeUninstalledDays { get; set; }

    public virtual Branch? ServerCheckBranch { get; set; }
}

using System.Text.Json;

namespace YevUsbAgent;

public sealed class Policy
{
    public static readonly Policy Off = new(PolicyModes.Off, null, new HashSet<string>(), new HashSet<string>(), false, null);

    public Policy(int mode, string? version, HashSet<string> approved, HashSet<string> readOnly, bool trackCopyIn, string? uninstallPasswordHash)
    {
        Mode = mode;
        Version = version;
        Approved = approved;
        ReadOnly = readOnly;
        TrackCopyIn = trackCopyIn;
        UninstallPasswordHash = uninstallPasswordHash;
    }

    public int Mode { get; }
    public string? Version { get; }
    public HashSet<string> Approved { get; }
    public HashSet<string> ReadOnly { get; }
    public bool TrackCopyIn { get; }
    public string? UninstallPasswordHash { get; }

    // Serial-less disks are never approved: every stick of that model would share the approval.
    public bool IsApproved(string key, string serial) => serial.Length > 0 && Approved.Contains(key);

    public bool IsReadOnly(string key, string serial) => serial.Length > 0 && ReadOnly.Contains(key);
}

// Last policy pulled from the server, persisted so blocking keeps working offline and across restarts.
public sealed class PolicyStore
{
    private readonly string _path;
    private volatile Policy _current;
    private int _revision;

    public PolicyStore(string dataDir)
    {
        Directory.CreateDirectory(dataDir);
        _path = PathIn(dataDir);
        _current = Load(_path) ?? Policy.Off;
    }

    public static string PathIn(string dataDir) => Path.Combine(dataDir, "policy.json");

    public Policy Current => _current;

    // Bumped on every list or mode change so UsbMonitor re-evaluates the disks already plugged in.
    public int Revision => Volatile.Read(ref _revision);

    public void Update(SyncResponse data)
    {
        var current = _current;
        // Without the lists the server's version cannot be trusted; keep the old ones so the next sync asks again.
        var hasLists = data.Approved != null;
        var version = hasLists ? data.PolicyVersion : current.Version ?? "";
        var approved = hasLists ? ToSet(data.Approved) : current.Approved;
        var readOnly = hasLists ? ToSet(data.ReadOnly) : current.ReadOnly;

        var listsChanged = data.Mode != current.Mode || version != current.Version;
        if (!listsChanged && data.TrackCopyIn == current.TrackCopyIn && data.UninstallPasswordHash == current.UninstallPasswordHash) return;

        _current = new Policy(data.Mode, version, approved, readOnly, data.TrackCopyIn, data.UninstallPasswordHash);
        if (listsChanged) Interlocked.Increment(ref _revision);

        try
        {
            var file = new PolicyFile
            {
                Mode = data.Mode, Version = version, Approved = approved.ToList(), ReadOnly = readOnly.ToList(),
                TrackCopyIn = data.TrackCopyIn, UninstallPasswordHash = data.UninstallPasswordHash
            };
            File.WriteAllText(_path, JsonSerializer.Serialize(file, AgentJson.Default.PolicyFile));
        }
        catch (IOException) { }
    }

    private static HashSet<string> ToSet(List<string>? keys) => (keys ?? new List<string>()).Select(x => x.ToUpperInvariant()).ToHashSet();

    // A PC that has never synced cannot know whether it is under Enforce, so it starts in Off.
    public static Policy? Load(string path)
    {
        try
        {
            if (!File.Exists(path)) return null;
            var file = JsonSerializer.Deserialize(File.ReadAllText(path), AgentJson.Default.PolicyFile);
            return file == null ? null
                : new Policy(file.Mode, file.Version, file.Approved.ToHashSet(), file.ReadOnly.ToHashSet(), file.TrackCopyIn, file.UninstallPasswordHash);
        }
        catch (Exception ex) when (ex is IOException or JsonException or UnauthorizedAccessException)
        {
            return null;
        }
    }
}

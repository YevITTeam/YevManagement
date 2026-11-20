using System.Text.Json;

namespace YevUsbAgent;

public sealed class Policy
{
    public static readonly Policy Off = new(PolicyModes.Off, null, new HashSet<string>());

    public Policy(int mode, string? version, HashSet<string> approved)
    {
        Mode = mode;
        Version = version;
        Approved = approved;
    }

    public int Mode { get; }
    public string? Version { get; }
    public HashSet<string> Approved { get; }

    // Serial-less disks are never approved: every stick of that model would share the approval.
    public bool IsApproved(string key, string serial) => serial.Length > 0 && Approved.Contains(key);
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
        _path = Path.Combine(dataDir, "policy.json");
        _current = Load();
    }

    public Policy Current => _current;

    // Bumped on every change so UsbMonitor re-evaluates the disks already plugged in.
    public int Revision => Volatile.Read(ref _revision);

    public void Update(int mode, string version, List<string>? approved)
    {
        var current = _current;
        // Without the list the server's version cannot be trusted; keep the old one so the next sync asks again.
        if (approved == null) version = current.Version ?? "";
        if (mode == current.Mode && version == current.Version) return;

        var set = approved == null ? current.Approved : approved.Select(x => x.ToUpperInvariant()).ToHashSet();
        _current = new Policy(mode, version, set);
        Interlocked.Increment(ref _revision);

        try
        {
            var file = new PolicyFile { Mode = mode, Version = version, Approved = set.ToList() };
            File.WriteAllText(_path, JsonSerializer.Serialize(file, AgentJson.Default.PolicyFile));
        }
        catch (IOException) { }
    }

    // A PC that has never synced cannot know whether it is under Enforce, so it starts in Off.
    private Policy Load()
    {
        try
        {
            if (!File.Exists(_path)) return Policy.Off;
            var file = JsonSerializer.Deserialize(File.ReadAllText(_path), AgentJson.Default.PolicyFile);
            return file == null ? Policy.Off : new Policy(file.Mode, file.Version, file.Approved.ToHashSet());
        }
        catch (Exception ex) when (ex is IOException or JsonException)
        {
            return Policy.Off;
        }
    }
}

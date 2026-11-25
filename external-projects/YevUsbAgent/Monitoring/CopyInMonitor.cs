using System.Collections.Concurrent;

namespace YevUsbAgent;

// Guesses USB -> PC copies. Windows reports no reads, but Explorer/copy/robocopy keep the source's size and
// last-write time, so a new file on a fixed drive matching a file on a plugged USB on both is logged as copied in.
// ponytail: misses files opened in place, unzipped or re-saved by an app (new timestamp); a minifilter driver would not.
internal sealed class CopyInMonitor : IDisposable
{
    public sealed record UsbRoot(string Root, Guid SessionId);

    private const int MaxPending = 20_000;
    private const int MaxIndexedFiles = 200_000;
    private static readonly TimeSpan SettleDelay = TimeSpan.FromMilliseconds(1500);
    private static readonly TimeSpan IndexMaxAge = TimeSpan.FromSeconds(4);
    private static readonly TimeSpan DedupeWindow = TimeSpan.FromMinutes(5);

    // Profile caches, system and build folders churn files nobody copies from a USB.
    private static readonly string[] ExcludedFragments =
    {
        @"\Windows\", @"\ProgramData\", @"\$Recycle.Bin\", @"\System Volume Information\", @"\Program Files\",
        @"\Program Files (x86)\", @"\$WinREAgent\", @"\Recovery\", @"\Windows.old\", @"\MSOCache\", @"\Config.Msi\",
        @"\AppData\Local\", @"\AppData\LocalLow\", @"\AppData\Roaming\Microsoft\", @"\AppData\Roaming\Code\",
        @"\AppData\Roaming\npm\", @"\OneDriveTemp\", @"\.git\", @"\node_modules\", @"\.vs\", @"\__pycache__\"
    };

    private static readonly string[] ExcludedExtensions = { ".tmp", ".temp", ".crdownload", ".partial", ".part", ".etl", ".log", ".lock" };

    private readonly EventQueue _queue;
    private readonly ILogger _logger;
    private readonly Dictionary<string, FileSystemWatcher> _watchers = new(StringComparer.OrdinalIgnoreCase);
    private readonly ConcurrentDictionary<string, DateTime> _pending = new(StringComparer.OrdinalIgnoreCase);
    private readonly Dictionary<string, DateTime> _reported = new(StringComparer.OrdinalIgnoreCase);
    private Dictionary<string, (string Path, Guid SessionId)> _index = new(StringComparer.Ordinal);
    private DateTime _indexBuiltUtc = DateTime.MinValue;

    public CopyInMonitor(EventQueue queue, ILogger logger)
    {
        _queue = queue;
        _logger = logger;
    }

    // Called every poll with the readable USB drives; fixed drives are watched only while one is plugged in.
    public void Process(IReadOnlyList<UsbRoot> usbs)
    {
        Watch(usbs);
        if (usbs.Count == 0)
        {
            _pending.Clear();
            return;
        }

        var now = DateTime.UtcNow;
        var due = _pending.Where(kv => now - kv.Value >= SettleDelay).Select(kv => kv.Key).ToList();
        if (due.Count == 0) return;
        if (now - _indexBuiltUtc > IndexMaxAge) BuildIndex(usbs, now);

        foreach (var path in due)
        {
            _pending.TryRemove(path, out _);
            try
            {
                var info = new FileInfo(path);
                if (!info.Exists || info.Length == 0) continue;

                var key = $"{info.Length}_{info.LastWriteTimeUtc.Ticks}";
                if (!_index.TryGetValue(key, out var source)) continue;
                if (_reported.TryGetValue(path + "|" + key, out var last) && now - last < DedupeWindow) continue;
                _reported[path + "|" + key] = now;

                _queue.Enqueue(new AgentEvent
                {
                    Type = EventTypes.File,
                    SessionId = source.SessionId,
                    EventId = Guid.NewGuid(),
                    Action = FileActions.CopiedIn,
                    FilePath = path,
                    OldFilePath = source.Path,
                    SizeBytes = info.Length
                });
            }
            catch (Exception ex) when (ex is IOException or UnauthorizedAccessException) { }
        }

        if (_reported.Count > 5000)
            foreach (var stale in _reported.Where(kv => now - kv.Value > DedupeWindow).Select(kv => kv.Key).ToList())
                _reported.Remove(stale);
    }

    private void BuildIndex(IReadOnlyList<UsbRoot> usbs, DateTime now)
    {
        var index = new Dictionary<string, (string, Guid)>(StringComparer.Ordinal);
        var options = new EnumerationOptions { RecurseSubdirectories = true, IgnoreInaccessible = true, AttributesToSkip = FileAttributes.System };
        foreach (var usb in usbs)
        {
            try
            {
                foreach (var info in new DirectoryInfo(usb.Root).EnumerateFiles("*", options))
                {
                    if (index.Count >= MaxIndexedFiles) break;
                    if (info.Length > 0) index[$"{info.Length}_{info.LastWriteTimeUtc.Ticks}"] = (info.FullName, usb.SessionId);
                }
            }
            catch (Exception ex) when (ex is IOException or UnauthorizedAccessException) { }
        }
        _index = index;
        _indexBuiltUtc = now;
    }

    // USB enclosures with a hard disk report DriveType.Fixed too, so the plugged USB roots are excluded by letter.
    private void Watch(IReadOnlyList<UsbRoot> usbs)
    {
        var wanted = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        if (usbs.Count > 0)
            foreach (var drive in DriveInfo.GetDrives())
            {
                try
                {
                    if (drive.DriveType == DriveType.Fixed && drive.IsReady
                        && !usbs.Any(u => string.Equals(u.Root, drive.Name, StringComparison.OrdinalIgnoreCase)))
                        wanted.Add(drive.Name);
                }
                catch (IOException) { }
            }

        foreach (var root in _watchers.Keys.Where(r => !wanted.Contains(r)).ToList())
        {
            _watchers[root].Dispose();
            _watchers.Remove(root);
        }

        foreach (var root in wanted.Where(r => !_watchers.ContainsKey(r)))
        {
            try
            {
                var watcher = new FileSystemWatcher(root)
                {
                    IncludeSubdirectories = true,
                    NotifyFilter = NotifyFilters.FileName | NotifyFilters.LastWrite | NotifyFilters.Size,
                    InternalBufferSize = 64 * 1024
                };
                watcher.Created += (_, e) => Touch(e.FullPath);
                watcher.Changed += (_, e) => Touch(e.FullPath);
                watcher.Renamed += (_, e) => Touch(e.FullPath);
                // An overflow under heavy disk activity only loses a few guesses.
                watcher.Error += (_, _) => { };
                watcher.EnableRaisingEvents = true;
                _watchers[root] = watcher;
            }
            catch (Exception ex) when (ex is ArgumentException or IOException or UnauthorizedAccessException)
            {
                _logger.LogWarning("Cannot watch {Root} for copies from USB: {Message}", root, ex.Message);
            }
        }
    }

    private void Touch(string path)
    {
        if (_pending.Count >= MaxPending) return;
        if (ExcludedFragments.Any(f => path.Contains(f, StringComparison.OrdinalIgnoreCase))) return;
        if (ExcludedExtensions.Any(e => path.EndsWith(e, StringComparison.OrdinalIgnoreCase))) return;
        if (Path.GetFileName(path).StartsWith("~$", StringComparison.Ordinal)) return;
        _pending[path] = DateTime.UtcNow;
    }

    public void Dispose()
    {
        foreach (var watcher in _watchers.Values) watcher.Dispose();
        _watchers.Clear();
        _pending.Clear();
    }
}

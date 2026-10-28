using System.Collections.Concurrent;

namespace YevUsbAgent;

// Watches one mounted USB drive and turns file operations into queued events until disposed.
internal sealed class DriveSession : IDisposable
{
    // Writers fire many Changed events per file; one Modified is emitted after this much quiet.
    private const int QuietMs = 2000;

    private readonly Guid _sessionId;
    private readonly EventQueue _queue;
    private readonly ILogger _logger;
    private readonly FileSystemWatcher _watcher;
    private readonly ConcurrentDictionary<string, Timer> _pending = new(StringComparer.OrdinalIgnoreCase);

    public DriveSession(Guid sessionId, string root, EventQueue queue, ILogger logger)
    {
        _sessionId = sessionId;
        _queue = queue;
        _logger = logger;

        _watcher = new FileSystemWatcher(root)
        {
            IncludeSubdirectories = true,
            NotifyFilter = NotifyFilters.FileName | NotifyFilters.DirectoryName | NotifyFilters.LastWrite | NotifyFilters.Size,
            InternalBufferSize = 64 * 1024
        };
        _watcher.Created += (_, e) => OnCreated(e.FullPath);
        _watcher.Changed += (_, e) => OnChanged(e.FullPath);
        _watcher.Deleted += (_, e) => OnDeleted(e.FullPath);
        _watcher.Renamed += (_, e) => OnRenamed(e.OldFullPath, e.FullPath);
        _watcher.Error += (_, e) => _logger.LogWarning("Watcher error on {Root}: {Message}", root, e.GetException().Message);
    }

    public Guid SessionId => _sessionId;

    public void Start() => _watcher.EnableRaisingEvents = true;

    private void OnCreated(string path)
    {
        if (IsIgnored(path)) return;
        Emit(FileActions.Created, path, null, SizeOf(path));
    }

    private void OnChanged(string path)
    {
        // Directory timestamps change whenever their content does; only file writes matter.
        if (IsIgnored(path) || Directory.Exists(path)) return;

        var timer = _pending.GetOrAdd(path, p => new Timer(_ => FlushModified(p), null, Timeout.Infinite, Timeout.Infinite));
        try { timer.Change(QuietMs, Timeout.Infinite); }
        catch (ObjectDisposedException) { }
    }

    private void FlushModified(string path)
    {
        if (_pending.TryRemove(path, out var timer)) timer.Dispose();

        // The file may have been deleted or renamed while the timer waited.
        if (File.Exists(path)) Emit(FileActions.Modified, path, null, SizeOf(path));
    }

    private void OnDeleted(string path)
    {
        if (IsIgnored(path)) return;
        CancelPending(path);
        Emit(FileActions.Deleted, path, null, null);
    }

    private void OnRenamed(string oldPath, string newPath)
    {
        if (IsIgnored(newPath)) return;
        CancelPending(oldPath);

        // Editors save through a temp file and rename it over the real one: that is a save, not a rename.
        if (IsIgnored(oldPath))
        {
            OnChanged(newPath);
            return;
        }

        Emit(FileActions.Renamed, newPath, oldPath, SizeOf(newPath));
    }

    private void CancelPending(string path)
    {
        if (_pending.TryRemove(path, out var timer)) timer.Dispose();
    }

    private void Emit(int action, string path, string? oldPath, long? size)
    {
        _queue.Enqueue(new AgentEvent
        {
            Type = EventTypes.File,
            SessionId = _sessionId,
            EventId = Guid.NewGuid(),
            Action = action,
            FilePath = path,
            OldFilePath = oldPath,
            SizeBytes = size
        });
    }

    private static long? SizeOf(string path)
    {
        try { return File.Exists(path) ? new FileInfo(path).Length : null; }
        catch (IOException) { return null; }
    }

    // System folders and editor/OS scratch files (Office "~$" locks, ".tmp", Thumbs.db...) are noise, not user files.
    private static bool IsIgnored(string path)
    {
        if (path.Contains("\\System Volume Information", StringComparison.OrdinalIgnoreCase)
            || path.Contains("\\$RECYCLE.BIN", StringComparison.OrdinalIgnoreCase))
            return true;

        var name = Path.GetFileName(path);
        return name.StartsWith("~$", StringComparison.Ordinal)
               || name.StartsWith(".~lock.", StringComparison.Ordinal)
               || name.EndsWith(".tmp", StringComparison.OrdinalIgnoreCase)
               || name.Equals("Thumbs.db", StringComparison.OrdinalIgnoreCase)
               || name.Equals("desktop.ini", StringComparison.OrdinalIgnoreCase)
               || name.Equals(".DS_Store", StringComparison.OrdinalIgnoreCase);
    }

    public void Dispose()
    {
        _watcher.EnableRaisingEvents = false;
        _watcher.Dispose();
        foreach (var timer in _pending.Values) timer.Dispose();
        _pending.Clear();
    }
}

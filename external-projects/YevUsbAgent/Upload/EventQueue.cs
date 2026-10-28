using System.Text.Json;

namespace YevUsbAgent;

// Append-only JSON-lines file: survives restarts and server downtime. ponytail: no size cap, add one if a PC stays offline for weeks.
public sealed class EventQueue
{
    private readonly string _path;
    private readonly object _lock = new();

    public EventQueue(string dataDir)
    {
        Directory.CreateDirectory(dataDir);
        _path = Path.Combine(dataDir, "queue.jsonl");
    }

    public void Enqueue(AgentEvent ev)
    {
        var line = JsonSerializer.Serialize(ev, AgentJson.Default.AgentEvent);
        lock (_lock) File.AppendAllText(_path, line + "\n");
    }

    // LineCount includes unreadable lines so Remove drops exactly what Peek consumed.
    public (List<AgentEvent> Events, int LineCount) Peek(int max)
    {
        var events = new List<AgentEvent>();
        var lineCount = 0;
        lock (_lock)
        {
            if (!File.Exists(_path)) return (events, 0);

            foreach (var line in File.ReadLines(_path).Take(max))
            {
                lineCount++;
                try
                {
                    var ev = JsonSerializer.Deserialize(line, AgentJson.Default.AgentEvent);
                    if (ev != null) events.Add(ev);
                }
                catch (JsonException) { }
            }
        }
        return (events, lineCount);
    }

    public void Remove(int lineCount)
    {
        if (lineCount <= 0) return;
        lock (_lock)
        {
            var temp = _path + ".tmp";
            File.WriteAllLines(temp, File.ReadLines(_path).Skip(lineCount));
            File.Move(temp, _path, overwrite: true);
        }
    }
}

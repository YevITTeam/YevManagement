namespace YevUsbAgent;

public sealed class AgentOptions
{
    public string ServerUrl { get; set; } = "http://10.45.1.155:8081";

    public string ApiKey { get; set; } = "";

    public int PollSeconds { get; set; } = 3;

    public int UploadSeconds { get; set; } = 15;

    public int BatchSize { get; set; } = 200;

    // Empty = %ProgramData%\YevUsbAgent
    public string DataDir { get; set; } = "";

    public string ResolveDataDir() => string.IsNullOrWhiteSpace(DataDir)
        ? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "YevUsbAgent")
        : DataDir;
}

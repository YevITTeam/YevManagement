using Microsoft.Extensions.Hosting.WindowsServices;
using YevUsbAgent;

// Started by the service manager (or with --run for debugging) the exe is the agent; otherwise it is the installer.
if (!WindowsServiceHelpers.IsWindowsService() && !args.Contains("--run"))
    return Installer.Run(args);

var builder = Host.CreateApplicationBuilder(new HostApplicationBuilderSettings
{
    Args = args,
    // A Windows service starts in System32; settings must come from the install folder.
    ContentRootPath = AppContext.BaseDirectory
});

builder.Services.AddWindowsService(options => options.ServiceName = "YevUsbAgent");
builder.Services.Configure<AgentOptions>(builder.Configuration.GetSection("Agent"));
builder.Services.AddSingleton(sp =>
{
    var options = builder.Configuration.GetSection("Agent").Get<AgentOptions>() ?? new AgentOptions();
    return new EventQueue(options.ResolveDataDir());
});
builder.Services.AddHostedService<UsbMonitor>();
builder.Services.AddHostedService<Uploader>();

builder.Build().Run();
return 0;

using CompanySystem.HostApi.BackgroundServices;
using CompanySystem.HostApi.Configurations;
using CompanySystem.HostApi.Middlewares;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.OpenApi;
using Scalar.AspNetCore;
using Shared.Application.Authorization;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddControllers()
    .AddApplicationPart(typeof(Identity.Api.AssemblyReference).Assembly)
    .AddApplicationPart(typeof(Asset.Api.AssemblyReference).Assembly)
    .AddApplicationPart(typeof(Attendance.Api.AssemblyReference).Assembly)
    .AddApplicationPart(typeof(Workflow.Api.AssemblyReference).Assembly);

// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi(options =>
{
    options.AddDocumentTransformer((document, context, cancellationToken) =>
    {
        document.Components ??= new OpenApiComponents();
        document.Components.SecuritySchemes ??= new Dictionary<string, IOpenApiSecurityScheme>();

        document.Components.SecuritySchemes["Bearer"] = new OpenApiSecurityScheme
        {
            Type = SecuritySchemeType.Http,
            Scheme = "bearer",
            BearerFormat = "JWT",
            Description = "Nhập Access Token của bạn vào đây"
        };

        document.Security ??= new List<OpenApiSecurityRequirement>();

        document.Security.Add(new OpenApiSecurityRequirement
        {
            {
                new OpenApiSecuritySchemeReference("Bearer"),
                new List<string>()
            }
        });

        return Task.CompletedTask;
    });
});

builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    // Note: In production you should set KnownProxies or KnownNetworks for security
});

builder.Services.AddAuthConfig(builder.Configuration);

builder.Services.AddAuthorization(options => { options.FallbackPolicy = options.DefaultPolicy; });
builder.Services.AddSingleton<IAuthorizationHandler, PermissionAuthorizationHandler>();
builder.Services.AddSingleton<IAuthorizationPolicyProvider, PermissionPolicyProvider>();

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowNextJs", policy =>
    {
        policy.WithOrigins(
                  "http://localhost:8000",
                  "http://localhost:3000",
                  "http://10.45.1.49:8000",
                  "http://10.45.1.49:80",
                  "http://10.45.1.49",
                  "http://intra.yev.vn",
                  "http://10.45.1.155:3000",
                  "http://10.45.1.181:3000"
              )
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials()
              .WithExposedHeaders("Content-Disposition", "X-Missing-Device-Count")
              .SetPreflightMaxAge(TimeSpan.FromHours(24)); ;
    });
});

// Configure dependency injection for Identity and Asset modules
builder.Services.AddDIConfig(builder.Configuration);

// Bật lại (2026-08-22) nhưng đổi việc: không còn tự chuyển trạng thái Device
// PendingUse/InUse -> PendingLiquidation -> Liquidated nữa (chuyển trạng thái giờ chỉ còn thao
// tác thủ công hoặc import thanh lý hàng loạt) — job chỉ còn tự soft-delete Device đang Liquidated.
builder.Services.AddHostedService<DeviceLiquidationBackgroundService>();
// Redesign xong theo Cây chức vụ (2026-08-07, Giai đoạn 3.2) — xem docs/attendance-module.md §Đơn tổng.
builder.Services.AddHostedService<OtFormBatchBackgroundService>();
// Gửi email duyệt OT chạy nền, không chặn response Create/Approve (2026-09-03) — xem IBackgroundTaskQueue.
builder.Services.AddHostedService<QueuedHostedService>();

var app = builder.Build();

// Add the exception handling middleware to the pipeline
app.UseMiddleware<HandleExceptionMiddleware>();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi().AllowAnonymous();
    app.MapScalarApiReference().AllowAnonymous();
}

// KHÔNG UseHttpsRedirection: site này chỉ serve HTTP thuần (không có binding HTTPS thật ở IIS —
// mọi Base URL trong docs đều là http://). Bật middleware này sẽ trả 307 cho MỌI request kể cả
// preflight OPTIONS, mà theo spec CORS 1 preflight bị redirect coi như thất bại (Chrome báo nhầm
// thành "No Access-Control-Allow-Origin header" dù whitelist đã đúng) — vì UseCors không bao giờ
// chạy tới để gắn header (2026-08-08).
app.UseCors("AllowNextJs");

// Apply forwarded headers before authentication so client IP and scheme are correct
app.UseForwardedHeaders();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();
using CompanySystem.HostApi.BackgroundServices;
using CompanySystem.HostApi.Configurations;
using CompanySystem.HostApi.Middlewares;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.OpenApi;
using Scalar.AspNetCore;
using Shared.Application.Authorization;

var builder = WebApplication.CreateBuilder(args);

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
                  "http://10.45.1.49",
                  "https://intra.yev.vn",
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

builder.Services.AddDIConfig(builder.Configuration);

// Only soft-deletes Liquidated devices; status transitions are manual or via import.
builder.Services.AddHostedService<DeviceLiquidationBackgroundService>();
builder.Services.AddHostedService<OtFormBatchBackgroundService>();
builder.Services.AddHostedService<GeneralAffairsBackgroundService>();
builder.Services.AddHostedService<QueuedHostedService>();
builder.Services.AddHostedService<EmailOutboxBackgroundService>();

var app = builder.Build();

app.UseMiddleware<HandleExceptionMiddleware>();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi().AllowAnonymous();
    app.MapScalarApiReference().AllowAnonymous();
}

app.UseCors("AllowNextJs");

// Apply forwarded headers before authentication so client IP and scheme are correct
app.UseForwardedHeaders();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();
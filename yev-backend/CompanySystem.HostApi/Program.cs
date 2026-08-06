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
    .AddApplicationPart(typeof(Attendance.Api.AssemblyReference).Assembly);

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
                  "http://10.45.1.155:3000",
                  "http://10.45.1.181:3000"
              )
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials()
              // Trình duyệt mặc định CHỈ cho JS đọc vài header "an toàn" (Content-Type, Content-Length...)
              // trên response khác origin — phải khai rõ 2 header dưới đây thì FE mới đọc được, dùng cho
              // endpoint tải file .xlsx: Content-Disposition (tên file gợi ý) và X-Missing-Device-Count
              // (đối chiếu Tanium, xem DeviceConfigurationImportController.GetMissingDevicesReport).
              .WithExposedHeaders("Content-Disposition", "X-Missing-Device-Count");
    });
});

// Configure dependency injection for Identity and Asset modules
builder.Services.AddDIConfig(builder.Configuration);

builder.Services.AddHostedService<DeviceLiquidationBackgroundService>();
builder.Services.AddHostedService<OtFormBatchBackgroundService>();

var app = builder.Build();

// Add the exception handling middleware to the pipeline
app.UseMiddleware<HandleExceptionMiddleware>();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi().AllowAnonymous();
    app.MapScalarApiReference().AllowAnonymous();
}

app.UseHttpsRedirection();
app.UseCors("AllowNextJs");

// Apply forwarded headers before authentication so client IP and scheme are correct
app.UseForwardedHeaders();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();
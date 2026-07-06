using CompanySystem.HostApi.Configurations;
using CompanySystem.HostApi.Middlewares;
using Microsoft.AspNetCore.HttpOverrides;
using Scalar.AspNetCore;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddControllers()
    .AddApplicationPart(typeof(Identity.Api.AssemblyReference).Assembly)
    .AddApplicationPart(typeof(Asset.Api.AssemblyReference).Assembly);

// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();

builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    // Note: In production you should set KnownProxies or KnownNetworks for security
});

builder.Services.AddAuthConfig(builder.Configuration);

builder.Services.AddAuthorization(options => { options.FallbackPolicy = options.DefaultPolicy; });

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowNextJs", policy =>
    {
        policy.WithOrigins(
                  "http://localhost:3000",
                  "http://10.45.1.181:3000"
              )
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

// Configure dependency injection for Identity and Asset modules
builder.Services.AddDIConfig(builder.Configuration);

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
using CompanySystem.HostApi.Configurations;
using Microsoft.AspNetCore.Authentication.Negotiate;
using Microsoft.AspNetCore.HttpOverrides;
using Scalar.AspNetCore;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.

builder.Services.AddControllers();
// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();

builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    // Note: In production you should set KnownProxies or KnownNetworks for security
});

//Set up Windows Auth
builder.Services.AddAuthentication(NegotiateDefaults.AuthenticationScheme).AddNegotiate();
builder.Services.AddAuthorization(options => { options.FallbackPolicy = options.DefaultPolicy; });


builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowNextJs", policy =>
    {
        // Thêm IP mạng LAN của bạn vào đây (cách nhau bằng dấu phẩy)
        policy.WithOrigins(
                  "http://localhost:3000",
                  "http://10.45.1.181:3000" // Sửa lại đúng với IP máy bạn nếu IP khác nhé
              )
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials(); // Bắt buộc để truyền Windows Auth
    });
});
// Configure dependency injection for Identity and Asset modules
builder.Services.AddDIConfig(builder.Configuration);

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.MapScalarApiReference();
}

app.UseHttpsRedirection();
app.UseCors("AllowNextJs"); // Bắt buộc nằm trước Auth
// Apply forwarded headers before authentication so client IP and scheme are correct
app.UseForwardedHeaders();
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();

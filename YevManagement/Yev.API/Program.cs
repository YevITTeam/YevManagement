using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Negotiate;
using Microsoft.EntityFrameworkCore;
using Yev.API.Security;
using Yev.Repositories;
using Yev.Repositories.Implementations;
using Yev.Repositories.Interfaces;
using Yev.Services.Implementations;
using Yev.Services.Interfaces;
using Yev.API.Configurations;
using Microsoft.AspNetCore.HttpOverrides;

using Scalar.AspNetCore;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.

builder.Services.AddControllers();
// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();

// Đăng ký DbContext từ tầng API, ép cấu hình sử dụng SQL Server
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("PCManagementConnection")));

//Đăng ký DI cho các Repository và Service
builder.Services.AddInfrastructureAndServices();

//Đăng ký DI
//builder.Services.AddScoped<IAuthRepository, AuthRepository>();
//builder.Services.AddScoped<IAuthService, AuthService>();
//builder.Services.AddScoped<IRoleRepository, RoleRepository>();
//builder.Services.AddScoped<IRoleService, RoleService>();

//Đăng ký DI cho MyClaimsTransformation dùng cho đăng nhập Windows Auth
builder.Services.AddScoped<IClaimsTransformation, MyClaimsTransformation>();

// Register IHttpContextAccessor so we can read HttpContext in services (for example to get remote IP)
builder.Services.AddHttpContextAccessor();

// Configure forwarded headers so X-Forwarded-For is populated when behind a proxy
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    // Note: In production you should set KnownProxies or KnownNetworks for security
});

// 3. Cấu hình Windows Auth
builder.Services.AddAuthentication(NegotiateDefaults.AuthenticationScheme).AddNegotiate();
builder.Services.AddAuthorization(options => { options.FallbackPolicy = options.DefaultPolicy; });

// 4. Mở cửa CORS cho Next.js
// 4. Mở cửa CORS cho Next.js
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

builder.Services.AddEndpointsApiExplorer();

//builder.Services.AddSwaggerGen();

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.MapScalarApiReference();

    //app.UseSwagger();
    //app.UseSwaggerUI();
}

app.UseHttpsRedirection();

app.UseCors("AllowNextJs"); // Bắt buộc nằm trước Auth
// Apply forwarded headers before authentication so client IP and scheme are correct
app.UseForwardedHeaders();
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();

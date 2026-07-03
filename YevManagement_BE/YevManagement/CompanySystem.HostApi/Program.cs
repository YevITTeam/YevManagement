using CompanySystem.HostApi.Configurations;
using Scalar.AspNetCore;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.

builder.Services.AddControllers()
    .AddApplicationPart(typeof(Identity.Api.AssemblyReference).Assembly)
    .AddApplicationPart(typeof(Asset.Api.AssemblyReference).Assembly);
// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();

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

app.UseAuthorization();

app.MapControllers();

app.Run();

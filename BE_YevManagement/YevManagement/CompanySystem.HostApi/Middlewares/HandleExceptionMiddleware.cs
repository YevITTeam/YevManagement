using Microsoft.EntityFrameworkCore;
using Shared.Application.Wrapper;
using Shared.Core.Exceptions;
using System.ComponentModel.DataAnnotations;
using System.Net;
using System.Text.Json;

namespace CompanySystem.HostApi.Middlewares
{
    public class HandleExceptionMiddleware
    {
        private readonly RequestDelegate _next;
        private readonly ILogger<HandleExceptionMiddleware> _logger;

        public HandleExceptionMiddleware(RequestDelegate next, ILogger<HandleExceptionMiddleware> logger)
        {
            _next = next;
            _logger = logger;
        }

        public async Task InvokeAsync(HttpContext context)
        {
            try
            {
                await _next(context);
            }
            catch (Exception ex)
            {
                var clientIp = context.Connection.RemoteIpAddress?.ToString() ?? "Unknown";
                _logger.LogError(ex, "Exception occurred from IP: {IP} | Message: {Message}", clientIp, ex.Message);
                await HandleExceptionAsync(context, ex);
            }
        }

        private static Task HandleExceptionAsync(HttpContext context, Exception exception)
        {
            context.Response.ContentType = "application/json";

            var statusCode = (int)HttpStatusCode.InternalServerError;
            var message = "An unexpected error occurred on the server.";
            List<string>? errors = null;

            switch (exception)
            {
                case BaseException baseEx:
                    statusCode = baseEx.StatusCode;
                    message = baseEx.Message;
                    errors = baseEx.Errors ?? new List<string>();

                    if (baseEx.Data != null && baseEx.Data.Count > 0)
                    {
                        foreach (System.Collections.DictionaryEntry entry in baseEx.Data)
                        {
                            errors.Add($"{entry.Key}:{entry.Value}");
                        }
                    }

                    if (errors.Count == 0) errors = null;
                    break;

                case ValidationException validationException:
                    statusCode = (int)HttpStatusCode.BadRequest;
                    message = "One or more validation errors occurred.";
                    errors = new List<string> { validationException.ValidationResult?.ErrorMessage ?? validationException.Message };
                    break;

                case UnauthorizedAccessException:
                    statusCode = (int)HttpStatusCode.Unauthorized;
                    message = "Unauthorized access. Please provide a valid token.";
                    break;

                case KeyNotFoundException:
                    statusCode = (int)HttpStatusCode.NotFound;
                    message = "The requested resource was not found.";
                    break;

                case ArgumentException or InvalidOperationException:
                    statusCode = (int)HttpStatusCode.BadRequest;
                    message = exception.Message;
                    break;

                case DbUpdateException:
                    message = "A database error occurred.";
                    break;

                default:
                    message = "An unexpected error occurred.";
                    break;
            }

            context.Response.StatusCode = statusCode;

            var response = ApiResponse<object>.Failure(message, errors);

            var options = new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };
            return context.Response.WriteAsJsonAsync(response, options);
        }
    }
}
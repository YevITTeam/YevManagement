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

            // These messages are surfaced verbatim in the UI (getApiErrorMessage on the FE reads
            // `message`), and the whole product is Vietnamese — keep them in Vietnamese even though
            // the code and comments are English.
            var statusCode = (int)HttpStatusCode.InternalServerError;
            var message = "Đã xảy ra lỗi không mong muốn trên máy chủ.";
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
                    message = "Dữ liệu gửi lên không hợp lệ.";
                    errors = new List<string> { validationException.ValidationResult?.ErrorMessage ?? validationException.Message };
                    break;

                case UnauthorizedAccessException:
                    statusCode = (int)HttpStatusCode.Unauthorized;
                    message = "Phiên đăng nhập không hợp lệ hoặc đã hết hạn, vui lòng đăng nhập lại.";
                    break;

                case KeyNotFoundException:
                    statusCode = (int)HttpStatusCode.NotFound;
                    message = "Không tìm thấy dữ liệu yêu cầu.";
                    break;

                case ArgumentException or InvalidOperationException:
                    statusCode = (int)HttpStatusCode.BadRequest;
                    message = exception.Message;
                    break;

                // Reaching this case usually means a service skipped its own duplicate/FK check —
                // see GuardExtensions.ThrowIfDuplicateCode for the soft-delete trap that used to
                // land here as a bare 500.
                case DbUpdateException:
                    message = "Không lưu được dữ liệu do vi phạm ràng buộc của cơ sở dữ liệu.";
                    break;

                default:
                    message = "Đã xảy ra lỗi không mong muốn.";
                    break;
            }

            context.Response.StatusCode = statusCode;

            var response = ApiResponse<object>.Failure(message, errors);

            var options = new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };
            return context.Response.WriteAsJsonAsync(response, options);
        }
    }
}
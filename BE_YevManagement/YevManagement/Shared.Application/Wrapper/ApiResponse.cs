using System;
using System.Collections.Generic;
using System.Text;

namespace Shared.Application.Wrapper
{
    public class ApiResponse<T>
    {
        public bool IsSuccess { get; set; }
        public string? Message { get; set; }
        public T? Data { get; set; }
        public List<string>? Errors { get; set; }
        public DateTime Timestamp { get; set; }

        public ApiResponse()
        {
            Timestamp = DateTime.UtcNow;
        }

        public static ApiResponse<T> Success(T data, string message = "Action Success")
        {
            return new ApiResponse<T>
            {
                IsSuccess = true,
                Data = data,
                Message = message,
                Errors = null
            };
        }

        public static ApiResponse<PagedResponse<T>> Success(PagedResponse<T> data, string message = "Action Success")
        {
            return new ApiResponse<PagedResponse<T>>
            {
                IsSuccess = true,
                Data = data,
                Message = message
            };
        }

        public static ApiResponse<T> Failure(string message, List<string>? errors = null)
        {
            return new ApiResponse<T>
            {
                IsSuccess = false,
                Data = default,
                Message = message,
                Errors = errors
            };
        }
    }
}

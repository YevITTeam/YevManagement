using Microsoft.AspNetCore.Mvc;
using Shared.Application.Wrapper;
using System;
using System.Collections.Generic;
using System.Text;

namespace Asset.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class BaseController : ControllerBase
    {
        protected ActionResult<ApiResponse<T>> Success<T>(T data, string message = "Success")
        {
            var response = new ApiResponse<T>
            {
                IsSuccess = true,
                Message = message,
                Data = data
            };
            return Ok(response);
        }

        protected ActionResult<ApiResponse<T>> Fail<T>(string message)
        {
            var response = new ApiResponse<T>
            {
                IsSuccess = false,
                Message = message,
                Data = default!
            };
            return BadRequest(response);
        }

        protected IActionResult CreatedSuccess<T>(string actionName, object routeValues, T data, string message = "Resource created successfully")
        {
            var response = new ApiResponse<T>
            {
                IsSuccess = true,
                Message = message,
                Data = data
            };
            return CreatedAtAction(actionName, routeValues, response);
        }

        protected IActionResult NoContentSuccess()
        {
            return NoContent();
        }
    }
}

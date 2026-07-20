using Microsoft.AspNetCore.Mvc;
using Shared.Application.Wrapper;

namespace Attendance.Api.Controllers
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

        // Current username from the JWT claim (ClaimTypes.Name) — used as CreatedByUserName/ApproverUserName/
        // UserName on Attendance tables since Identity.User lives in a different DB with no numeric UserId claim.
        protected string CurrentUserName => User.Identity?.Name
            ?? throw new UnauthorizedAccessException("Không xác định được người dùng hiện tại.");

        // Display full name from the JWT claim "FullName" (populated by MyClaimsTransformation from
        // Identity.User.FullName). Null if the account hasn't had FullName entered by an Admin yet —
        // used as a snapshot so PDF printing doesn't need to call across to Identity.
        protected string? CurrentFullName => User.FindFirst("FullName")?.Value;
    }
}

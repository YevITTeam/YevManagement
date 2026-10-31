using Microsoft.AspNetCore.Mvc;
using Shared.Application.Wrapper;

namespace Workflow.Api.Controllers
{
    // "Workflow/" prefix is required: Attendance already has EmployeeController/JobTitleController on
    // "api/[controller]", so without it routing fails with AmbiguousMatchException.
    [ApiController]
    [Route("api/Workflow/[controller]")]
    public class WorkflowBaseController : ControllerBase
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

        // Read by raw claim name to avoid referencing Identity.Application; null on tokens issued before
        // the "UserId" claim existed (user must re-login).
        protected int? CurrentUserId
        {
            get
            {
                var raw = User.FindFirst("UserId")?.Value;
                return int.TryParse(raw, out var id) ? id : null;
            }
        }
    }
}

using Microsoft.AspNetCore.Mvc;
using Shared.Application.Wrapper;

namespace Workflow.Api.Controllers
{
    // Prefix "Workflow/" bắt buộc phải có: Attendance module đã có sẵn EmployeeController và
    // JobTitleController trùng route "api/[controller]" (workflow-module.md §1.1 — 2 module cố ý độc
    // lập nhưng trùng tên entity Employee/JobTitle). Không prefix sẽ vỡ routing ở runtime với
    // AmbiguousMatchException (phát hiện 2026-08-24 khi smoke-test sau khi scaffold module).
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

        // Numeric Identity.Users.Id from the JWT claim "UserId" (Identity.Application.Authentication.
        // IdentityClaimTypes.UserId — read by raw string, not by referencing Identity.Application, to
        // keep Workflow independent per workflow-module.md §1.1/§1.4). Used to resolve the current
        // Employee via Employees.UserId for CreatedByEmployeeId/UpdatedByEmployeeId-style columns.
        // Null for a JWT issued before this claim existed (2026-08-25) — caller must re-login.
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

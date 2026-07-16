using Asset.Application.Dtos.AuditTrails;
using Asset.Application.Interfaces.Service;
using Microsoft.AspNetCore.Mvc;
using Shared.Application.Authorization;
using Shared.Application.Wrapper;

namespace Asset.Api.Controllers
{
    public class AuditTrailController : BaseController
    {
        private readonly IAuditTrailService _auditTrailService;

        public AuditTrailController(IAuditTrailService auditTrailService)
        {
            _auditTrailService = auditTrailService;
        }

        [RequirePermission("Asset.AuditTrail.View")]
        [HttpGet("grid-list")]
        public async Task<ActionResult<ApiResponse<PagedResponse<AuditTrailDto>>>> GetPaged([FromQuery] AuditTrailFilterRequest request)
        {
            var result = await _auditTrailService.GetPagedAsync(request);
            return Success(result);
        }

        [RequirePermission("Asset.AuditTrail.View")]
        [HttpGet("record")]
        public async Task<ActionResult<ApiResponse<List<AuditTrailDto>>>> GetByRecord([FromQuery] string tableName, [FromQuery] int recordId)
        {
            var result = await _auditTrailService.GetByRecordAsync(tableName, recordId);
            return Success(result);
        }
    }
}

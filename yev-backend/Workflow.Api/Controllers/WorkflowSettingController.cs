using Microsoft.AspNetCore.Mvc;
using Shared.Application.Authorization;
using Shared.Application.Wrapper;
using Workflow.Application.Dtos.WorkflowSettings;
using Workflow.Application.Interfaces.Service;

namespace Workflow.Api.Controllers
{
    // Cấu hình module, luôn 1 dòng (workflow-module.md §3.4 WorkflowSettings) — chỉ Get/Update, không
    // Create/Delete. Permission Workflow.Setting.Manage (§7).
    public class WorkflowSettingController : WorkflowBaseController
    {
        private readonly IWorkflowSettingService _workflowSettingService;

        public WorkflowSettingController(IWorkflowSettingService workflowSettingService)
        {
            _workflowSettingService = workflowSettingService;
        }

        [RequirePermission("Workflow.Setting.Manage")]
        [HttpGet]
        public async Task<ActionResult<ApiResponse<WorkflowSettingDto>>> Get()
        {
            var result = await _workflowSettingService.GetAsync();
            return Success(result);
        }

        [RequirePermission("Workflow.Setting.Manage")]
        [HttpPut]
        public async Task<ActionResult<ApiResponse<WorkflowSettingDto>>> Update([FromBody] UpdateWorkflowSettingDto request)
        {
            var result = await _workflowSettingService.UpdateAsync(request);
            return Success(result, "Cập nhật cấu hình thành công.");
        }
    }
}

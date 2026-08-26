using Shared.Application.Services;
using Shared.Core.Exceptions;
using Workflow.Application.Dtos.WorkflowSettings;
using Workflow.Application.Interfaces.Service;

namespace Workflow.Application.Services
{
    // WorkflowSettings luôn đúng 1 dòng, Id = 1, seed sẵn trong migration (workflow-module.md §3.4) —
    // Service không có Create/Delete, chỉ Get/Update dòng duy nhất đó.
    public class WorkflowSettingService : BaseService<IWorkflowUnitOfWork>, IWorkflowSettingService
    {
        private const int SettingsId = 1;

        public WorkflowSettingService(IWorkflowUnitOfWork unitOfWork) : base(unitOfWork) { }

        public async Task<WorkflowSettingDto> GetAsync()
        {
            var entity = (await _unitOfWork.WorkflowSettings.GetByIdAsync(SettingsId)).OrThrowNotFound("Cấu hình Workflow", SettingsId);
            return ToDto(entity);
        }

        public async Task<WorkflowSettingDto> UpdateAsync(UpdateWorkflowSettingDto request)
        {
            var entity = (await _unitOfWork.WorkflowSettings.GetByIdAsync(SettingsId)).OrThrowNotFound("Cấu hình Workflow", SettingsId);

            entity.MaxAttachmentSizeMb = request.MaxAttachmentSizeMb;
            entity.AllowedFileExtensions = request.AllowedFileExtensions;
            entity.MaxAttachmentPerRequest = request.MaxAttachmentPerRequest;
            entity.EmailTokenExpiryDays = request.EmailTokenExpiryDays;

            _unitOfWork.WorkflowSettings.Update(entity);
            await _unitOfWork.SaveChangesAsync();

            return ToDto(entity);
        }

        private static WorkflowSettingDto ToDto(Domain.Entities.WorkflowSetting entity) => new()
        {
            MaxAttachmentSizeMb = entity.MaxAttachmentSizeMb,
            AllowedFileExtensions = entity.AllowedFileExtensions,
            MaxAttachmentPerRequest = entity.MaxAttachmentPerRequest,
            EmailTokenExpiryDays = entity.EmailTokenExpiryDays
        };
    }
}

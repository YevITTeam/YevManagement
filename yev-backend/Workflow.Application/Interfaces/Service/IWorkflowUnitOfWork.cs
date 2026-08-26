using Shared.Application.Abstractions;
using Workflow.Application.Interfaces.Repository;

namespace Workflow.Application.Interfaces.Service
{
    public interface IWorkflowUnitOfWork : IUnitOfWork
    {
        IOrgLevelRepository OrgLevels { get; }
        IOrgUnitRepository OrgUnits { get; }
        IJobTitleRepository JobTitles { get; }
        IEmployeeRepository Employees { get; }
        IEmployeeOrgUnitRepository EmployeeOrgUnits { get; }
        IFormCategoryRepository FormCategories { get; }
        IFormCategoryCoordinatorRepository FormCategoryCoordinators { get; }
        IFormDataSourceRepository FormDataSources { get; }
        IFormDefinitionRepository FormDefinitions { get; }
        IFormFieldRepository FormFields { get; }
        IFormFieldConditionRepository FormFieldConditions { get; }
        IFormAccessRepository FormAccesses { get; }
        IFormRouteRepository FormRoutes { get; }
        IFormApprovalStepRepository FormApprovalSteps { get; }
        IFormApprovalStepParticipantRepository FormApprovalStepParticipants { get; }
        IWorkflowRequestRepository WorkflowRequests { get; }
        IWorkflowRequestStepRepository WorkflowRequestSteps { get; }
        IWorkflowRequestStepParticipantRepository WorkflowRequestStepParticipants { get; }
        IWorkflowRequestHistoryRepository WorkflowRequestHistories { get; }
        IWorkflowSequenceRepository WorkflowSequences { get; }
        IApprovalDelegationRepository ApprovalDelegations { get; }
        IEmployeeSignatureRepository EmployeeSignatures { get; }
        IPendingEmployeeSignatureConfirmationRepository PendingEmployeeSignatureConfirmations { get; }
        IWorkflowAttachmentRepository WorkflowAttachments { get; }
        IWorkflowSettingRepository WorkflowSettings { get; }
    }
}

using Shared.Infrastructure.Data;
using Workflow.Application.Interfaces.Repository;
using Workflow.Application.Interfaces.Service;
using Workflow.Infrastructure.Context;

namespace Workflow.Infrastructure.Repositories
{
    public class WorkflowUnitOfWork : BaseUnitOfWork<WorkflowDbContext>, IWorkflowUnitOfWork
    {
        public WorkflowUnitOfWork(
            WorkflowDbContext dbContext,
            IOrgLevelRepository orgLevels,
            IOrgUnitRepository orgUnits,
            IJobTitleRepository jobTitles,
            IEmployeeRepository employees,
            IEmployeeOrgUnitRepository employeeOrgUnits,
            IOrgLevelJobTitleSuggestionRepository orgLevelJobTitleSuggestions,
            IFormCategoryRepository formCategories,
            IFormCategoryCoordinatorRepository formCategoryCoordinators,
            IFormDataSourceRepository formDataSources,
            IFormDefinitionRepository formDefinitions,
            IFormFieldRepository formFields,
            IFormFieldConditionRepository formFieldConditions,
            IFormAccessRepository formAccesses,
            IFormRouteRepository formRoutes,
            IFormApprovalStepRepository formApprovalSteps,
            IFormApprovalStepParticipantRepository formApprovalStepParticipants,
            IWorkflowRequestRepository workflowRequests,
            IWorkflowRequestStepRepository workflowRequestSteps,
            IWorkflowRequestStepParticipantRepository workflowRequestStepParticipants,
            IWorkflowRequestHistoryRepository workflowRequestHistories,
            IWorkflowSequenceRepository workflowSequences,
            IApprovalDelegationRepository approvalDelegations,
            IEmployeeSignatureRepository employeeSignatures,
            IPendingEmployeeSignatureConfirmationRepository pendingEmployeeSignatureConfirmations,
            IWorkflowAttachmentRepository workflowAttachments,
            IWorkflowSettingRepository workflowSettings,
            IWorkflowRequestEmailTokenRepository workflowRequestEmailTokens) : base(dbContext)
        {
            OrgLevels = orgLevels;
            OrgUnits = orgUnits;
            JobTitles = jobTitles;
            Employees = employees;
            EmployeeOrgUnits = employeeOrgUnits;
            OrgLevelJobTitleSuggestions = orgLevelJobTitleSuggestions;
            FormCategories = formCategories;
            FormCategoryCoordinators = formCategoryCoordinators;
            FormDataSources = formDataSources;
            FormDefinitions = formDefinitions;
            FormFields = formFields;
            FormFieldConditions = formFieldConditions;
            FormAccesses = formAccesses;
            FormRoutes = formRoutes;
            FormApprovalSteps = formApprovalSteps;
            FormApprovalStepParticipants = formApprovalStepParticipants;
            WorkflowRequests = workflowRequests;
            WorkflowRequestSteps = workflowRequestSteps;
            WorkflowRequestStepParticipants = workflowRequestStepParticipants;
            WorkflowRequestHistories = workflowRequestHistories;
            WorkflowSequences = workflowSequences;
            ApprovalDelegations = approvalDelegations;
            EmployeeSignatures = employeeSignatures;
            PendingEmployeeSignatureConfirmations = pendingEmployeeSignatureConfirmations;
            WorkflowAttachments = workflowAttachments;
            WorkflowSettings = workflowSettings;
            WorkflowRequestEmailTokens = workflowRequestEmailTokens;
        }

        public IOrgLevelRepository OrgLevels { get; }
        public IOrgUnitRepository OrgUnits { get; }
        public IJobTitleRepository JobTitles { get; }
        public IEmployeeRepository Employees { get; }
        public IEmployeeOrgUnitRepository EmployeeOrgUnits { get; }
        public IOrgLevelJobTitleSuggestionRepository OrgLevelJobTitleSuggestions { get; }
        public IFormCategoryRepository FormCategories { get; }
        public IFormCategoryCoordinatorRepository FormCategoryCoordinators { get; }
        public IFormDataSourceRepository FormDataSources { get; }
        public IFormDefinitionRepository FormDefinitions { get; }
        public IFormFieldRepository FormFields { get; }
        public IFormFieldConditionRepository FormFieldConditions { get; }
        public IFormAccessRepository FormAccesses { get; }
        public IFormRouteRepository FormRoutes { get; }
        public IFormApprovalStepRepository FormApprovalSteps { get; }
        public IFormApprovalStepParticipantRepository FormApprovalStepParticipants { get; }
        public IWorkflowRequestRepository WorkflowRequests { get; }
        public IWorkflowRequestStepRepository WorkflowRequestSteps { get; }
        public IWorkflowRequestStepParticipantRepository WorkflowRequestStepParticipants { get; }
        public IWorkflowRequestHistoryRepository WorkflowRequestHistories { get; }
        public IWorkflowSequenceRepository WorkflowSequences { get; }
        public IApprovalDelegationRepository ApprovalDelegations { get; }
        public IEmployeeSignatureRepository EmployeeSignatures { get; }
        public IPendingEmployeeSignatureConfirmationRepository PendingEmployeeSignatureConfirmations { get; }
        public IWorkflowAttachmentRepository WorkflowAttachments { get; }
        public IWorkflowSettingRepository WorkflowSettings { get; }
        public IWorkflowRequestEmailTokenRepository WorkflowRequestEmailTokens { get; }
    }
}

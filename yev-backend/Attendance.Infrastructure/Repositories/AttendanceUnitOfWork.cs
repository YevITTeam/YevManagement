using Attendance.Application.Interfaces.Repository;
using Attendance.Application.Interfaces.Service;
using Attendance.Infrastructure.Context;
using Shared.Infrastructure.Data;

namespace Attendance.Infrastructure.Repositories
{
    public class AttendanceUnitOfWork : BaseUnitOfWork<AttendanceDbContext>, IAttendanceUnitOfWork
    {
        public AttendanceUnitOfWork(
            AttendanceDbContext dbContext,
            IDepartmentRepository departments,
            IGroupRepository groups,
            IReasonRepository reasons,
            IOtCaseRepository otCases,
            IEmployeeRepository employees,
            IOtFormRepository otForms,
            IOtFormEmployeeRepository otFormEmployees,
            IProcessPartRepository processParts,
            IOtFormApprovalHistoryRepository otFormApprovalHistories,
            IUserSignatureRepository userSignatures,
            IPendingSignatureConfirmationRepository pendingSignatureConfirmations,
            IOtFormApprovalEmailTokenRepository otFormApprovalEmailTokens,
            ISecondaryPasswordRepository secondaryPasswords,
            IPendingSecondaryPasswordConfirmationRepository pendingSecondaryPasswordConfirmations,
            IAttendanceSettingRepository attendanceSettings,
            IOtFormBatchRepository otFormBatches,
            IOtFormBatchEmailTokenRepository otFormBatchEmailTokens,
            IJobTitleRepository jobTitles,
            IDepartmentApprovalStepRepository departmentApprovalSteps,
            IGroupApprovalStepRepository groupApprovalSteps,
            IOtFormApprovalStepRepository otFormApprovalSteps,
            IOtFormApprovalStepCandidateRepository otFormApprovalStepCandidates,
            IJobTitlePermissionRepository jobTitlePermissions,
            IDepartmentApprovalStepCoordinatorRepository departmentApprovalStepCoordinators,
            IGroupApprovalStepCoordinatorRepository groupApprovalStepCoordinators) : base(dbContext)
        {
            AttendanceSettings = attendanceSettings;
            OtFormBatches = otFormBatches;
            OtFormBatchEmailTokens = otFormBatchEmailTokens;
            JobTitles = jobTitles;
            DepartmentApprovalSteps = departmentApprovalSteps;
            GroupApprovalSteps = groupApprovalSteps;
            OtFormApprovalSteps = otFormApprovalSteps;
            OtFormApprovalStepCandidates = otFormApprovalStepCandidates;
            JobTitlePermissions = jobTitlePermissions;
            DepartmentApprovalStepCoordinators = departmentApprovalStepCoordinators;
            GroupApprovalStepCoordinators = groupApprovalStepCoordinators;
            Departments = departments;
            Groups = groups;
            Reasons = reasons;
            OtCases = otCases;
            Employees = employees;
            OtForms = otForms;
            OtFormEmployees = otFormEmployees;
            ProcessParts = processParts;
            OtFormApprovalHistories = otFormApprovalHistories;
            UserSignatures = userSignatures;
            PendingSignatureConfirmations = pendingSignatureConfirmations;
            OtFormApprovalEmailTokens = otFormApprovalEmailTokens;
            SecondaryPasswords = secondaryPasswords;
            PendingSecondaryPasswordConfirmations = pendingSecondaryPasswordConfirmations;
        }

        public IDepartmentRepository Departments { get; }
        public IGroupRepository Groups { get; }
        public IReasonRepository Reasons { get; }
        public IOtCaseRepository OtCases { get; }
        public IEmployeeRepository Employees { get; }
        public IOtFormRepository OtForms { get; }
        public IOtFormEmployeeRepository OtFormEmployees { get; }
        public IProcessPartRepository ProcessParts { get; }
        public IOtFormApprovalHistoryRepository OtFormApprovalHistories { get; }
        public IUserSignatureRepository UserSignatures { get; }
        public IPendingSignatureConfirmationRepository PendingSignatureConfirmations { get; }
        public IOtFormApprovalEmailTokenRepository OtFormApprovalEmailTokens { get; }
        public ISecondaryPasswordRepository SecondaryPasswords { get; }
        public IPendingSecondaryPasswordConfirmationRepository PendingSecondaryPasswordConfirmations { get; }
        public IAttendanceSettingRepository AttendanceSettings { get; }
        public IOtFormBatchRepository OtFormBatches { get; }
        public IOtFormBatchEmailTokenRepository OtFormBatchEmailTokens { get; }
        public IJobTitleRepository JobTitles { get; }
        public IDepartmentApprovalStepRepository DepartmentApprovalSteps { get; }
        public IGroupApprovalStepRepository GroupApprovalSteps { get; }
        public IOtFormApprovalStepRepository OtFormApprovalSteps { get; }
        public IOtFormApprovalStepCandidateRepository OtFormApprovalStepCandidates { get; }
        public IJobTitlePermissionRepository JobTitlePermissions { get; }
        public IDepartmentApprovalStepCoordinatorRepository DepartmentApprovalStepCoordinators { get; }
        public IGroupApprovalStepCoordinatorRepository GroupApprovalStepCoordinators { get; }
    }
}

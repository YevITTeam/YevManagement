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
            IWorkshopRepository workshops,
            IEmployeeApprovalScopeRepository employeeApprovalScopes,
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
            IWorkCalendarDayRepository workCalendarDays,
            IOtFormBatchRepository otFormBatches,
            IOtFormBatchEmailTokenRepository otFormBatchEmailTokens,
            IJobTitleRepository jobTitles,
            IDepartmentApprovalStepRepository departmentApprovalSteps,
            IGroupApprovalStepRepository groupApprovalSteps,
            IOtFormApprovalStepRepository otFormApprovalSteps,
            IOtFormApprovalStepCandidateRepository otFormApprovalStepCandidates,
            IJobTitlePermissionRepository jobTitlePermissions,
            IDepartmentApprovalStepCoordinatorRepository departmentApprovalStepCoordinators,
            IGroupApprovalStepCoordinatorRepository groupApprovalStepCoordinators,
            IGroupBorrowedApproverRepository groupBorrowedApprovers,
            IEmployeeAccumulationHistoryRepository employeeAccumulationHistories,
            IProductionLineRepository productionLines,
            IProductionShiftTeamRepository productionShiftTeams,
            IProductionTeamRepository productionTeams,
            IProductionApprovalStepRepository productionApprovalSteps,
            IOtFormEditLogRepository otFormEditLogs,
            IApprovalDelegationRepository approvalDelegations,
            IAttendanceAuditTrailRepository attendanceAuditTrails,
            IAttendanceMailLogRepository attendanceMailLogs,
            IGeneralAffairsDispatchRepository generalAffairsDispatches,
            IGeneralAffairsRecipientRepository generalAffairsRecipients) : base(dbContext)
        {
            ApprovalDelegations = approvalDelegations;
            AttendanceAuditTrails = attendanceAuditTrails;
            AttendanceMailLogs = attendanceMailLogs;
            GeneralAffairsDispatches = generalAffairsDispatches;
            GeneralAffairsRecipients = generalAffairsRecipients;
            OtFormEditLogs = otFormEditLogs;
            EmployeeAccumulationHistories = employeeAccumulationHistories;
            ProductionLines = productionLines;
            ProductionShiftTeams = productionShiftTeams;
            ProductionTeams = productionTeams;
            ProductionApprovalSteps = productionApprovalSteps;
            AttendanceSettings = attendanceSettings;
            WorkCalendarDays = workCalendarDays;
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
            GroupBorrowedApprovers = groupBorrowedApprovers;
            Departments = departments;
            Groups = groups;
            Workshops = workshops;
            EmployeeApprovalScopes = employeeApprovalScopes;
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

        public IWorkshopRepository Workshops { get; }

        public IEmployeeApprovalScopeRepository EmployeeApprovalScopes { get; }
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
        public IWorkCalendarDayRepository WorkCalendarDays { get; }
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
        public IGroupBorrowedApproverRepository GroupBorrowedApprovers { get; }
        public IEmployeeAccumulationHistoryRepository EmployeeAccumulationHistories { get; }
        public IProductionLineRepository ProductionLines { get; }
        public IProductionShiftTeamRepository ProductionShiftTeams { get; }
        public IProductionTeamRepository ProductionTeams { get; }
        public IProductionApprovalStepRepository ProductionApprovalSteps { get; }
        public IOtFormEditLogRepository OtFormEditLogs { get; }
        public IApprovalDelegationRepository ApprovalDelegations { get; }
        public IAttendanceAuditTrailRepository AttendanceAuditTrails { get; }
        public IAttendanceMailLogRepository AttendanceMailLogs { get; }
        public IGeneralAffairsDispatchRepository GeneralAffairsDispatches { get; }
        public IGeneralAffairsRecipientRepository GeneralAffairsRecipients { get; }
    }
}

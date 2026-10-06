using Attendance.Application.Dtos.JobTitles;
using Attendance.Application.Interfaces.Service;
using Attendance.Domain.Enums;
using Shared.Application.Services;
using Shared.Core.Exceptions;

namespace Attendance.Application.Services
{
    // Giai đoạn 2b (2026-08-06) — chuỗi duyệt đọc từ DepartmentApprovalStep (cấu hình TAY theo từng
    // Phòng ban), KHÔNG còn tự bắc cầu qua mọi RankOrder đang có người giữ. Giai đoạn 3.1 (2026-08-07)
    // wiring thật vào OtFormService.CreateAsync qua ResolveChainForCreationAsync. Giai đoạn 4
    // (2026-08-08) — tách cấu hình cấp trung gian (Staff/Group Leader/Team Leader) xuống
    // GroupApprovalStep theo từng Nhóm, chỉ còn 3 cấp cuối (Manager/Factory Manager/Director) ở
    // DepartmentApprovalStep theo Bộ phận — xem docs/docs-be/attendance-module.md §Cây chức vụ.
    //
    // Phạm vi tìm ứng viên mỗi bước:
    //   - Chức vụ TerminalLevel=None (Staff/Group Leader/Team Leader, từ GroupApprovalStep) → CHỈ
    //     tính Employee.GroupId == groupId (đúng Nhóm của người tạo đơn, không lan sang Nhóm khác
    //     cùng Bộ phận — 2026-08-08, trước đó gộp chung theo cả Bộ phận).
    //   - Chức vụ TerminalLevel=WorkshopManager/GeneralDirector (Factory Manager/Director) → dùng
    //     chung toàn công ty, KHÔNG lọc theo Department.
    //   - Chức vụ TerminalLevel=DepartmentManager (Manager) → chỉ tính người có
    //     Employee.Group.DepartmentId hoặc Employee.DepartmentId khớp đúng Department của người tạo
    //     đơn (Trưởng phòng không thuộc Group cụ thể nào, dùng thẳng Employee.DepartmentId).
    public class JobTitleApprovalChainService : BaseService<IAttendanceUnitOfWork>, IJobTitleApprovalChainService
    {
        public JobTitleApprovalChainService(IAttendanceUnitOfWork unitOfWork) : base(unitOfWork) { }

        public async Task<ResolveApprovalChainResultDto> ResolveChainAsync(int creatorEmployeeId, int otCaseId)
        {
            var creator = await _unitOfWork.Employees.FirstOrDefaultAsync(
                x => x.Id == creatorEmployeeId && !x.IsDeleted, x => x.Group!, x => x.JobTitle!);
            creator.OrThrowNotFound("Nhân viên", creatorEmployeeId);

            if (creator!.JobTitleId is null || creator.JobTitle is null)
                throw new DomainException($"Nhân viên '{creator.Code}' chưa được gán chức vụ — không thể suy luận chuỗi duyệt.");

            // Người tạo đơn OT phải thuộc 1 Nhóm thật (GroupId) — Trưởng phòng/Trưởng Xưởng/Giám đốc
            // (2026-08-08, GroupId null) không tạo đơn OT cho chính họ qua luồng này.
            if (creator.Group is null)
                throw new DomainException($"Nhân viên '{creator.Code}' không thuộc Nhóm nào (Trưởng phòng/Trưởng Xưởng/Giám đốc) — không áp dụng cho việc tạo đơn OT.");

            return await ResolveChainCoreAsync(creator.JobTitle.RankOrder, creator.Group.Id, creator.Group.DepartmentId, otCaseId);
        }

        public async Task<ResolveApprovalChainResultDto> ResolveChainForCreationAsync(int? creatorEmployeeId, int groupId, int departmentId, int otCaseId)
        {
            var creatorRank = 0;

            if (creatorEmployeeId.HasValue)
            {
                var creator = await _unitOfWork.Employees.FirstOrDefaultAsync(
                    x => x.Id == creatorEmployeeId.Value && !x.IsDeleted, x => x.JobTitle!);
                if (creator?.JobTitle != null)
                    creatorRank = creator.JobTitle.RankOrder;
            }

            return await ResolveChainCoreAsync(creatorRank, groupId, departmentId, otCaseId);
        }

        private class ConfiguredStepRow
        {
            public int StepOrder { get; set; }
            public int JobTitleId { get; set; }
            public string JobTitleCode { get; set; } = null!;
            public string JobTitleName { get; set; } = null!;
            public int RankOrder { get; set; }
            public bool RequiresSignature { get; set; }
            public bool IsResponsible { get; set; }
            public int TerminalLevel { get; set; }

            // Chỉ có giá trị thật khi đọc từ ProductionApprovalStep (đơn "theo chuyền") — xem
            // JobTitle.IsLineScoped, ResolveChainForProductionCreationAsync.
            public bool IsLineScoped { get; set; }
        }

        private async Task<ResolveApprovalChainResultDto> ResolveChainCoreAsync(int creatorRank, int groupId, int departmentId, int otCaseId)
        {
            var otCase = await _unitOfWork.OtCases.FirstOrDefaultAsync(x => x.Id == otCaseId && !x.IsDeleted);
            otCase.OrThrowNotFound("Trường hợp OT", otCaseId);

            var targetTerminalLevel = otCase!.RequiredApprovalLevel;
            var targetJobTitle = await _unitOfWork.JobTitles.FirstOrDefaultAsync(
                x => x.TerminalLevel == targetTerminalLevel && !x.IsDeleted);

            if (targetJobTitle is null)
            {
                return new ResolveApprovalChainResultDto
                {
                    IsComplete = false,
                    Warning = $"Chưa có Chức vụ nào được cấu hình làm cấp duyệt cuối tương ứng (TerminalLevel={targetTerminalLevel})."
                };
            }

            // Cấp trung gian (Staff/Group Leader/Team Leader) đọc từ GroupApprovalStep theo groupId,
            // rồi nối tiếp cấp cuối (Manager/Factory Manager/Director) đọc từ DepartmentApprovalStep
            // theo departmentId — LUÔN đi hết Nhóm trước rồi mới tới Bộ phận, không xen kẽ theo
            // StepOrder thô (2 nguồn StepOrder độc lập, không so sánh chéo được).
            var groupSteps = await _unitOfWork.GroupApprovalSteps.SelectAsync(
                predicate: x => x.GroupId == groupId && !x.IsDeleted,
                selector: x => new ConfiguredStepRow
                {
                    StepOrder = x.StepOrder,
                    JobTitleId = x.JobTitle.Id,
                    JobTitleCode = x.JobTitle.Code,
                    JobTitleName = x.JobTitle.Name,
                    RankOrder = x.JobTitle.RankOrder,
                    RequiresSignature = x.RequiresSignature,
                    IsResponsible = x.IsResponsible,
                    TerminalLevel = x.JobTitle.TerminalLevel
                });

            var departmentSteps = await _unitOfWork.DepartmentApprovalSteps.SelectAsync(
                predicate: x => x.DepartmentId == departmentId && !x.IsDeleted,
                selector: x => new ConfiguredStepRow
                {
                    StepOrder = x.StepOrder,
                    JobTitleId = x.JobTitle.Id,
                    JobTitleCode = x.JobTitle.Code,
                    JobTitleName = x.JobTitle.Name,
                    RankOrder = x.JobTitle.RankOrder,
                    RequiresSignature = x.RequiresSignature,
                    IsResponsible = false,
                    TerminalLevel = x.JobTitle.TerminalLevel
                });

            var configuredSteps = groupSteps.OrderBy(x => x.StepOrder)
                .Concat(departmentSteps.OrderBy(x => x.StepOrder))
                .ToList();

            // Xem ResolveApprovalChainResultDto.RequiresCreatorSelfSign — tính TRƯỚC khi lọc relevantSteps
            // vì phải so với TOÀN BỘ Chức vụ "Bắt buộc ký" đã cấu hình (kể cả các bước đã bị lọc ra vì
            // RankOrder <= creatorRank), không phải chỉ các bước còn lại trong chuỗi của đơn này. Tính
            // được ngay cả khi configuredSteps rỗng (khi đó tự nhiên = false, không có gì để tự ký thay).
            var configuredSigningIntermediateSteps = configuredSteps
                .Where(x => x.TerminalLevel == (int)JobTitleTerminalLevel.None && x.RequiresSignature)
                .ToList();
            var requiresCreatorSelfSign = creatorRank > 0
                && configuredSigningIntermediateSteps.Count > 0
                && configuredSigningIntermediateSteps.All(x => x.RankOrder <= creatorRank);

            // Người tạo đã ở cấp bằng/cao hơn cấp duyệt cuối cần tới — không cần bước duyệt nào (kiểm
            // tra SAU khi đã tính requiresCreatorSelfSign để đơn hoàn tất ngay vẫn snapshot đúng chữ ký
            // tự ký của người tạo, không riêng gì trường hợp còn bước tới Trưởng phòng).
            if (targetJobTitle.RankOrder <= creatorRank)
                return new ResolveApprovalChainResultDto { IsComplete = true, RequiresCreatorSelfSign = requiresCreatorSelfSign };

            if (configuredSteps.Count == 0)
            {
                return new ResolveApprovalChainResultDto
                {
                    IsComplete = false,
                    Warning = "Nhóm/Bộ phận của người tạo đơn chưa được cấu hình cây duyệt (xem màn \"Cây duyệt\", phần \"Cây duyệt Nhóm\"/\"Cây duyệt Bộ phận\")."
                };
            }

            // Chỉ giữ các bước ở cấp CAO HƠN người tạo (người tạo không tự duyệt đơn của mình), theo
            // đúng thứ tự đã ghép Nhóm→Bộ phận ở trên, rồi cắt tại bước đầu tiên chạm đúng cấp duyệt
            // cuối cần tới — các bước cấu hình sau đó (nếu có) không liên quan tới OtCase này.
            var relevantSteps = configuredSteps
                .Where(x => x.RankOrder > creatorRank)
                .ToList();

            var cutoffIndex = relevantSteps.FindIndex(x => x.TerminalLevel == targetTerminalLevel);
            var reachesTarget = cutoffIndex >= 0;
            if (reachesTarget)
            {
                relevantSteps = relevantSteps.Take(cutoffIndex + 1).ToList();
            }

            if (relevantSteps.Count == 0)
            {
                return new ResolveApprovalChainResultDto
                {
                    IsComplete = false,
                    Warning = $"Cây duyệt của Nhóm/Bộ phận chưa có bước nào phù hợp để tới '{targetJobTitle.Name}'.",
                    RequiresCreatorSelfSign = requiresCreatorSelfSign
                };
            }

            var intermediateJobTitleIds = relevantSteps
                .Where(x => x.TerminalLevel == (int)JobTitleTerminalLevel.None)
                .Select(x => x.JobTitleId)
                .ToList();
            var deptScopedJobTitleIds = relevantSteps
                .Where(x => x.TerminalLevel == (int)JobTitleTerminalLevel.DepartmentManager)
                .Select(x => x.JobTitleId)
                .ToList();
            var companyWideJobTitleIds = relevantSteps
                .Where(x => x.TerminalLevel == (int)JobTitleTerminalLevel.WorkshopManager
                    || x.TerminalLevel == (int)JobTitleTerminalLevel.GeneralDirector)
                .Select(x => x.JobTitleId)
                .ToList();

            // Cấp trung gian: CHỈ đúng Nhóm của người tạo đơn (2026-08-08, thắt chặt so với trước —
            // trước đây lọc theo cả Bộ phận nên lẫn ứng viên giữa các Nhóm không liên quan).
            var intermediateCandidates = intermediateJobTitleIds.Count == 0
                ? new List<(int JobTitleId, int Id, string UserName, string FirstName, string LastName)>()
                : (await _unitOfWork.Employees.SelectAsync(
                    predicate: x => !x.IsDeleted && x.UserName != null && x.GroupId == groupId
                        && x.JobTitleId != null && intermediateJobTitleIds.Contains(x.JobTitleId.Value),
                    selector: x => new { JobTitleId = x.JobTitleId!.Value, x.Id, x.UserName, x.FirstName, x.LastName }))
                    .Select(x => (x.JobTitleId, x.Id, UserName: x.UserName!, x.FirstName, x.LastName))
                    .ToList();

            // Khớp cả 2 đường tới Department: qua Group (nhân viên thường giữ Chức vụ trung gian) hoặc
            // trực tiếp Employee.DepartmentId (Trưởng phòng — TerminalLevel=DepartmentManager, không
            // thuộc Nhóm cụ thể nào).
            var deptCandidates = deptScopedJobTitleIds.Count == 0
                ? new List<(int JobTitleId, int Id, string UserName, string FirstName, string LastName)>()
                : (await _unitOfWork.Employees.SelectAsync(
                    predicate: x => !x.IsDeleted && x.UserName != null
                        && ((x.Group != null && x.Group.DepartmentId == departmentId) || x.DepartmentId == departmentId)
                        && x.JobTitleId != null && deptScopedJobTitleIds.Contains(x.JobTitleId.Value),
                    selector: x => new { JobTitleId = x.JobTitleId!.Value, x.Id, x.UserName, x.FirstName, x.LastName }))
                    .Select(x => (x.JobTitleId, x.Id, UserName: x.UserName!, x.FirstName, x.LastName))
                    .ToList();

            var companyWideCandidates = companyWideJobTitleIds.Count == 0
                ? new List<(int JobTitleId, int Id, string UserName, string FirstName, string LastName)>()
                : (await _unitOfWork.Employees.SelectAsync(
                    predicate: x => !x.IsDeleted && x.UserName != null
                        && x.JobTitleId != null && companyWideJobTitleIds.Contains(x.JobTitleId.Value),
                    selector: x => new { JobTitleId = x.JobTitleId!.Value, x.Id, x.UserName, x.FirstName, x.LastName }))
                    .Select(x => (x.JobTitleId, x.Id, UserName: x.UserName!, x.FirstName, x.LastName))
                    .ToList();

            var allCandidates = intermediateCandidates.Concat(deptCandidates).Concat(companyWideCandidates).ToList();

            var steps = relevantSteps
                .Select((step, index) => new ResolvedApprovalStepDto
                {
                    StepOrder = index + 1,
                    JobTitleId = step.JobTitleId,
                    JobTitleCode = step.JobTitleCode,
                    JobTitleName = step.JobTitleName,
                    RankOrder = step.RankOrder,
                    RequiresSignature = step.RequiresSignature,
                    IsResponsible = step.IsResponsible,
                    TerminalLevel = step.TerminalLevel,
                    Candidates = allCandidates
                        .Where(c => c.JobTitleId == step.JobTitleId)
                        .Select(c => new ResolvedApprovalCandidateDto
                        {
                            EmployeeId = c.Id,
                            UserName = c.UserName,
                            FullName = $"{c.LastName} {c.FirstName}"
                        })
                        .ToList()
                })
                .ToList();

            var isComplete = reachesTarget && steps.All(x => x.Candidates.Count > 0);

            string? warning = null;
            if (!reachesTarget)
                warning = $"Cây duyệt của Nhóm/Bộ phận chưa cấu hình tới cấp '{targetJobTitle.Name}' — đơn sẽ bị kẹt.";
            else if (!isComplete)
            {
                var missingStepNames = steps.Where(x => x.Candidates.Count == 0).Select(x => x.JobTitleName);
                warning = $"Chưa có ai giữ Chức vụ: {string.Join(", ", missingStepNames)} trong Nhóm/Bộ phận — đơn sẽ bị kẹt ở (các) bước này.";
            }

            return new ResolveApprovalChainResultDto
            {
                IsComplete = isComplete,
                Steps = steps,
                Warning = warning,
                RequiresCreatorSelfSign = requiresCreatorSelfSign
            };
        }

        public async Task<ResolveApprovalChainResultDto> ResolveChainForProductionCreationAsync(
            int? creatorEmployeeId, int departmentId, List<int> employeeIds, int otCaseId)
        {
            var creatorRank = 0;
            if (creatorEmployeeId.HasValue)
            {
                var creator = await _unitOfWork.Employees.FirstOrDefaultAsync(
                    x => x.Id == creatorEmployeeId.Value && !x.IsDeleted, x => x.JobTitle!);
                if (creator?.JobTitle != null)
                    creatorRank = creator.JobTitle.RankOrder;
            }

            var otCase = await _unitOfWork.OtCases.FirstOrDefaultAsync(x => x.Id == otCaseId && !x.IsDeleted);
            otCase.OrThrowNotFound("Trường hợp OT", otCaseId);

            var targetTerminalLevel = otCase!.RequiredApprovalLevel;
            var targetJobTitle = await _unitOfWork.JobTitles.FirstOrDefaultAsync(
                x => x.TerminalLevel == targetTerminalLevel && !x.IsDeleted);

            if (targetJobTitle is null)
            {
                return new ResolveApprovalChainResultDto
                {
                    IsComplete = false,
                    Warning = $"Chưa có Chức vụ nào được cấu hình làm cấp duyệt cuối tương ứng (TerminalLevel={targetTerminalLevel})."
                };
            }

            var configuredSteps = (await _unitOfWork.ProductionApprovalSteps.SelectAsync(
                predicate: x => x.DepartmentId == departmentId && !x.IsDeleted,
                selector: x => new ConfiguredStepRow
                {
                    StepOrder = x.StepOrder,
                    JobTitleId = x.JobTitle.Id,
                    JobTitleCode = x.JobTitle.Code,
                    JobTitleName = x.JobTitle.Name,
                    RankOrder = x.JobTitle.RankOrder,
                    RequiresSignature = x.RequiresSignature,
                    IsResponsible = x.IsResponsible,
                    TerminalLevel = x.JobTitle.TerminalLevel,
                    IsLineScoped = x.JobTitle.IsLineScoped
                }))
                .OrderBy(x => x.StepOrder)
                .ToList();

            var configuredSigningIntermediateSteps = configuredSteps
                .Where(x => x.TerminalLevel == (int)JobTitleTerminalLevel.None && x.RequiresSignature)
                .ToList();
            var requiresCreatorSelfSign = creatorRank > 0
                && configuredSigningIntermediateSteps.Count > 0
                && configuredSigningIntermediateSteps.All(x => x.RankOrder <= creatorRank);

            if (targetJobTitle.RankOrder <= creatorRank)
                return new ResolveApprovalChainResultDto { IsComplete = true, RequiresCreatorSelfSign = requiresCreatorSelfSign };

            if (configuredSteps.Count == 0)
            {
                return new ResolveApprovalChainResultDto
                {
                    IsComplete = false,
                    Warning = "Bộ phận này chưa cấu hình cây duyệt theo chuyền (xem màn \"Cây duyệt\", phần \"Cây duyệt Chuyền\")."
                };
            }

            // ">=" (không phải ">") — người tạo đơn "theo chuyền" không phải Admin BẮT BUỘC là Line
            // Leader thật của Line trong đơn (xem OtFormService.CreateProductionFormAsync), tức
            // creatorRank ở đây chỉ có thể là 0 (Admin, không lọc gì khác nhau) hoặc ĐÚNG RankOrder của
            // chính bước Line Leader — dùng ">" sẽ loại luôn bước của chính họ, khiến đơn gửi thẳng lên
            // Group Leader mà Line Leader không có bước Pending nào để tự ký/sửa trước (2026-09-03, theo
            // yêu cầu người dùng — đơn phải dừng ở bước Line Leader tới khi họ tự ký mới gửi lên trên).
            var relevantSteps = configuredSteps.Where(x => x.RankOrder >= creatorRank).ToList();

            var cutoffIndex = relevantSteps.FindIndex(x => x.TerminalLevel == targetTerminalLevel);
            var reachesTarget = cutoffIndex >= 0;
            if (reachesTarget)
                relevantSteps = relevantSteps.Take(cutoffIndex + 1).ToList();

            if (relevantSteps.Count == 0)
            {
                return new ResolveApprovalChainResultDto
                {
                    IsComplete = false,
                    Warning = $"Cây duyệt chuyền của Bộ phận chưa có bước nào phù hợp để tới '{targetJobTitle.Name}'.",
                    RequiresCreatorSelfSign = requiresCreatorSelfSign
                };
            }

            // Trong 1 chuỗi duy nhất, cấp trung gian (TerminalLevel=None) tách làm 2 phạm vi khác nhau:
            // Line Leader (IsLineScoped=true, theo ProductionLineId) và Group Leader/Team Leader
            // (IsLineScoped=false) — Line Leader suy TỰ ĐỘNG từ chính những người đang được thêm vào
            // đơn (KHÔNG có 1 ProductionLineId cố định trên OtForm); Group Leader/Team Leader dùng
            // chung CẢ Bộ phận Chế tạo (2026-08-28, theo yêu cầu người dùng — "GL/TL dưới chuyền là
            // người duyệt tổng luôn", KHÔNG scoped theo từng Nhóm sản xuất như bản trước — xem
            // attendance-module.md §Cây chức vụ & Cây duyệt). CHỈ áp dụng cho đơn "theo chuyền"; đơn "theo Nhóm"
            // (GroupApprovalStep, ResolveChainCoreAsync ở trên) vẫn giữ nguyên scoping theo Nhóm.
            //
            // Line Leader KHÔNG gán qua Employee.JobTitleId (2026-08-27, sửa lại theo yêu cầu người
            // dùng) — ai là Line Leader của Line nào đã có sẵn trong file import nhân sự dưới chuyền
            // (cột LEADER → ProductionEmployee.IsLeader, luôn mới nhất mỗi lần import lại), không cần
            // gán tay qua Cây chức vụ nữa. Group Leader/Team Leader thì KHÔNG có nguồn dữ liệu sẵn nào
            // tương tự (file import không phân cấp lãnh đạo) — vẫn phải gán tay qua Employee.JobTitleId
            // như trước (xem ApprovalStepManager.tsx khối "holders" mới ở tab Theo chuyền).
            var lineScopedJobTitleIds = relevantSteps
                .Where(x => x.TerminalLevel == (int)JobTitleTerminalLevel.None && x.IsLineScoped)
                .Select(x => x.JobTitleId)
                .ToList();
            var groupScopedJobTitleIds = relevantSteps
                .Where(x => x.TerminalLevel == (int)JobTitleTerminalLevel.None && !x.IsLineScoped)
                .Select(x => x.JobTitleId)
                .ToList();
            var deptScopedJobTitleIds = relevantSteps
                .Where(x => x.TerminalLevel == (int)JobTitleTerminalLevel.DepartmentManager)
                .Select(x => x.JobTitleId)
                .ToList();
            var companyWideJobTitleIds = relevantSteps
                .Where(x => x.TerminalLevel == (int)JobTitleTerminalLevel.WorkshopManager
                    || x.TerminalLevel == (int)JobTitleTerminalLevel.GeneralDirector)
                .Select(x => x.JobTitleId)
                .ToList();

            // Chỉ suy ra phạm vi Line khi TẤT CẢ người trong đơn cùng 1 ProductionLine — lẫn nhiều Line
            // thì phạm vi đó coi như không suy được (bước Line Leader sẽ không có ứng viên nào, hiển
            // thị đúng qua Warning bên dưới, không tự ý chọn đại 1 Line). Group Leader/Team Leader
            // không cần suy Group nữa (dùng chung cả Bộ phận, xem comment ở trên).
            int? derivedProductionLineId = null;
            if (employeeIds.Count > 0)
            {
                var participantLineIds = (await _unitOfWork.ProductionEmployees.SelectAsync(
                    predicate: x => x.EmployeeId.HasValue && employeeIds.Contains(x.EmployeeId.Value) && !x.IsDeleted,
                    selector: x => x.ProductionLineId))
                    .Distinct()
                    .ToList();
                if (participantLineIds.Count == 1 && participantLineIds[0].HasValue)
                    derivedProductionLineId = participantLineIds[0];
            }

            var lineLeaderHolders = (lineScopedJobTitleIds.Count == 0 || derivedProductionLineId is null)
                ? new List<(int Id, string UserName, string FirstName, string LastName)>()
                : (await _unitOfWork.ProductionEmployees.SelectAsync(
                    predicate: pe => !pe.IsDeleted && pe.IsLeader && pe.ProductionLineId == derivedProductionLineId
                        && pe.EmployeeId != null && !pe.Employee!.IsDeleted && pe.Employee!.UserName != null,
                    selector: pe => new { pe.Employee!.Id, pe.Employee!.UserName, pe.Employee!.FirstName, pe.Employee!.LastName }))
                    .Select(x => (x.Id, UserName: x.UserName!, x.FirstName, x.LastName))
                    .Distinct()
                    .ToList();

            // 1 người "IsLeader" áp dụng cho MỌI bước Line Leader trong chuỗi (thực tế luôn chỉ có 1
            // bước như vậy — file import chỉ có 1 cột LEADER, không phân biệt "Line Leader của bước
            // nào") — xem comment ở trên.
            var lineScopedCandidates = lineScopedJobTitleIds
                .SelectMany(jobTitleId => lineLeaderHolders.Select(h => (JobTitleId: jobTitleId, h.Id, h.UserName, h.FirstName, h.LastName)))
                .ToList();

            var groupScopedCandidates = groupScopedJobTitleIds.Count == 0
                ? new List<(int JobTitleId, int Id, string UserName, string FirstName, string LastName)>()
                : (await _unitOfWork.Employees.SelectAsync(
                    predicate: x => !x.IsDeleted && x.UserName != null
                        && ((x.Group != null && x.Group.DepartmentId == departmentId) || x.DepartmentId == departmentId)
                        && x.JobTitleId != null && groupScopedJobTitleIds.Contains(x.JobTitleId.Value),
                    selector: x => new { JobTitleId = x.JobTitleId!.Value, x.Id, x.UserName, x.FirstName, x.LastName }))
                    .Select(x => (x.JobTitleId, x.Id, UserName: x.UserName!, x.FirstName, x.LastName))
                    .ToList();

            var deptCandidates = deptScopedJobTitleIds.Count == 0
                ? new List<(int JobTitleId, int Id, string UserName, string FirstName, string LastName)>()
                : (await _unitOfWork.Employees.SelectAsync(
                    predicate: x => !x.IsDeleted && x.UserName != null
                        && ((x.Group != null && x.Group.DepartmentId == departmentId) || x.DepartmentId == departmentId)
                        && x.JobTitleId != null && deptScopedJobTitleIds.Contains(x.JobTitleId.Value),
                    selector: x => new { JobTitleId = x.JobTitleId!.Value, x.Id, x.UserName, x.FirstName, x.LastName }))
                    .Select(x => (x.JobTitleId, x.Id, UserName: x.UserName!, x.FirstName, x.LastName))
                    .ToList();

            var companyWideCandidates = companyWideJobTitleIds.Count == 0
                ? new List<(int JobTitleId, int Id, string UserName, string FirstName, string LastName)>()
                : (await _unitOfWork.Employees.SelectAsync(
                    predicate: x => !x.IsDeleted && x.UserName != null
                        && x.JobTitleId != null && companyWideJobTitleIds.Contains(x.JobTitleId.Value),
                    selector: x => new { JobTitleId = x.JobTitleId!.Value, x.Id, x.UserName, x.FirstName, x.LastName }))
                    .Select(x => (x.JobTitleId, x.Id, UserName: x.UserName!, x.FirstName, x.LastName))
                    .ToList();

            var allCandidates = lineScopedCandidates.Concat(groupScopedCandidates).Concat(deptCandidates).Concat(companyWideCandidates).ToList();

            var steps = relevantSteps
                .Select((step, index) => new ResolvedApprovalStepDto
                {
                    StepOrder = index + 1,
                    JobTitleId = step.JobTitleId,
                    JobTitleCode = step.JobTitleCode,
                    JobTitleName = step.JobTitleName,
                    RankOrder = step.RankOrder,
                    RequiresSignature = step.RequiresSignature,
                    IsResponsible = step.IsResponsible,
                    TerminalLevel = step.TerminalLevel,
                    Candidates = allCandidates
                        .Where(c => c.JobTitleId == step.JobTitleId)
                        .Select(c => new ResolvedApprovalCandidateDto
                        {
                            EmployeeId = c.Id,
                            UserName = c.UserName,
                            FullName = $"{c.LastName} {c.FirstName}"
                        })
                        .ToList()
                })
                .ToList();

            var isComplete = reachesTarget && steps.All(x => x.Candidates.Count > 0);

            string? warning = null;
            if (!reachesTarget)
                warning = $"Cây duyệt chuyền của Bộ phận chưa cấu hình tới cấp '{targetJobTitle.Name}' — đơn sẽ bị kẹt.";
            else if (!isComplete)
            {
                var missingStepNames = steps.Where(x => x.Candidates.Count == 0).Select(x => x.JobTitleName);
                warning = $"Chưa tìm được ứng viên cho: {string.Join(", ", missingStepNames)} — có thể chưa có ai giữ Chức vụ đó " +
                    "trong Bộ phận, hoặc (riêng Line Leader) những người trong đơn đang lẫn nhiều Line khác nhau — đơn sẽ bị kẹt " +
                    "ở (các) bước này.";
            }

            return new ResolveApprovalChainResultDto
            {
                IsComplete = isComplete,
                Steps = steps,
                Warning = warning,
                RequiresCreatorSelfSign = requiresCreatorSelfSign
            };
        }
    }
}

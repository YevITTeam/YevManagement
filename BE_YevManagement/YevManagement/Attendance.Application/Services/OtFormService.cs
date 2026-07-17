using Attendance.Application.Dtos.OtForms;
using Attendance.Application.Interfaces.Service;
using Attendance.Domain.Entities;
using Attendance.Domain.Enums;
using Microsoft.Extensions.Configuration;
using Shared.Application.Helper;
using Shared.Application.Interfaces;
using Shared.Application.Services;
using Shared.Application.Wrapper;
using Shared.Core.Exceptions;

namespace Attendance.Application.Services
{
    public class OtFormService : BaseService<IAttendanceUnitOfWork>, IOtFormService
    {
        // Số giờ OT tối thiểu (không tính bằng) để nhân viên đủ điều kiện phiếu ăn (xem docs/attendance-module.md).
        private const decimal MinHoursForMealTicket = 2m;

        // Dài hơn hẳn hạn PendingSignatureConfirmation — cấp trên (Trưởng phòng/Trưởng xưởng/TGĐ)
        // ít khi mở app/hộp thư ngay, cần đủ thời gian để họ xử lý (xem docs/attendance-module.md).
        private const int EmailApprovalTokenExpiryDays = 3;

        private const string GeneralDirectorRoleName = "Tổng Giám Đốc";

        private readonly IUserDirectoryService _userDirectoryService;
        private readonly IEmailService _emailService;
        private readonly IEmailTemplateRenderer _emailTemplateRenderer;
        private readonly IConfiguration _configuration;

        public OtFormService(
            IAttendanceUnitOfWork unitOfWork,
            IUserDirectoryService userDirectoryService,
            IEmailService emailService,
            IEmailTemplateRenderer emailTemplateRenderer,
            IConfiguration configuration) : base(unitOfWork)
        {
            _userDirectoryService = userDirectoryService;
            _emailService = emailService;
            _emailTemplateRenderer = emailTemplateRenderer;
            _configuration = configuration;
        }

        public async Task<PagedResponse<OtFormListItemDto>> GetMyFormsAsync(string userName, int pageIndex, int pageSize)
        {
            var query = _unitOfWork.OtForms.GetQueryable(false, x => x.Group, x => x.Department, x => x.OtCase)
                .Where(x => !x.IsDeleted && x.CreatedByUserName == userName)
                .OrderByDescending(x => x.Id);

            return await _unitOfWork.OtForms.ToPagedResponseAsync(query, pageIndex, pageSize, x => new OtFormListItemDto
            {
                Id = x.Id,
                GroupNameVn = x.Group.GroupNameVn,
                DepartmentNameVn = x.Department.DepartmentNameVn,
                OtCaseCode = x.OtCase.Code,
                Date = x.Date,
                TotalHour = x.TotalHour,
                NumberOfEmployee = x.NumberOfEmployee,
                CreatedByUserName = x.CreatedByUserName,
                CreatedByFullName = x.CreatedByFullName,
                Status = x.Status,
                IsEditable = IsEditableStatus(x.Status)
            });
        }

        // Đơn Draft đang chờ CHÍNH mình (Trưởng nhóm) ký duyệt — endpoint riêng, gate bằng
        // Attendance.OTForm.Create (không phải .Approve, vì Trưởng Group role không có permission
        // Approve — xem docs/attendance-module.md §Người tạo đơn KHÁC Trưởng nhóm).
        public async Task<PagedResponse<OtFormListItemDto>> GetPendingSubmissionsAsync(
            string currentUserName, bool isAdmin, int pageIndex, int pageSize)
        {
            List<int> submitterDepartmentIds = new();
            List<int> submitterGroupIds = new();

            if (!isAdmin)
            {
                var scopes = await _unitOfWork.UserApprovalScopes.FindAsync(x =>
                    !x.IsDeleted && x.UserName == currentUserName && x.ApprovalLevel == (int)ApprovalLevel.Submitter);

                submitterDepartmentIds = scopes.Where(s => s.ScopeType == (int)ScopeType.Department).Select(s => s.ScopeId).ToList();
                submitterGroupIds = scopes.Where(s => s.ScopeType == (int)ScopeType.Group).Select(s => s.ScopeId).ToList();
            }

            var draftQuery = _unitOfWork.OtForms.GetQueryable(false, x => x.Group, x => x.Department, x => x.OtCase)
                .Where(x => !x.IsDeleted && x.Status == (int)OtFormStatus.Draft &&
                    (isAdmin || submitterDepartmentIds.Contains(x.DepartmentId) || submitterGroupIds.Contains(x.GroupId)))
                .OrderBy(x => x.Date);

            return await _unitOfWork.OtForms.ToPagedResponseAsync(draftQuery, pageIndex, pageSize, x => new OtFormListItemDto
            {
                Id = x.Id,
                GroupNameVn = x.Group.GroupNameVn,
                DepartmentNameVn = x.Department.DepartmentNameVn,
                OtCaseCode = x.OtCase.Code,
                Date = x.Date,
                TotalHour = x.TotalHour,
                NumberOfEmployee = x.NumberOfEmployee,
                CreatedByUserName = x.CreatedByUserName,
                CreatedByFullName = x.CreatedByFullName,
                Status = x.Status,
                IsEditable = IsEditableStatus(x.Status)
            });
        }

        // Lịch sử đơn CHÍNH mình đã xử lý (Ký/Duyệt/Từ chối) ở BẤT KỲ cấp nào (Submitter/DepartmentManager/
        // WorkshopManager/GeneralDirector) — dùng chung cho cả 4 vai trò vì tất cả đều có sẵn permission
        // Attendance.OTForm.View. Trước đây không có cách nào xem lại: `my-forms` chỉ lọc theo người TẠO
        // đơn (không phải người ký/duyệt), còn `pending-submissions`/`pending-approvals` chỉ hiện đơn
        // CHƯA xử lý — đơn vừa xử lý xong lập tức biến mất khỏi 2 danh sách đó (xem docs/attendance-module.md).
        public async Task<PagedResponse<OtFormListItemDto>> GetMyActionsAsync(string userName, int pageIndex, int pageSize)
        {
            var actedFormIds = await _unitOfWork.OtFormApprovalHistories.SelectAsync(
                h => h.ApproverUserName == userName, h => h.OtFormId);
            var distinctFormIds = actedFormIds.Distinct().ToList();

            var query = _unitOfWork.OtForms.GetQueryable(false, x => x.Group, x => x.Department, x => x.OtCase)
                .Where(x => !x.IsDeleted && distinctFormIds.Contains(x.Id))
                .OrderByDescending(x => x.Id);

            return await _unitOfWork.OtForms.ToPagedResponseAsync(query, pageIndex, pageSize, x => new OtFormListItemDto
            {
                Id = x.Id,
                GroupNameVn = x.Group.GroupNameVn,
                DepartmentNameVn = x.Department.DepartmentNameVn,
                OtCaseCode = x.OtCase.Code,
                Date = x.Date,
                TotalHour = x.TotalHour,
                NumberOfEmployee = x.NumberOfEmployee,
                CreatedByUserName = x.CreatedByUserName,
                CreatedByFullName = x.CreatedByFullName,
                Status = x.Status,
                IsEditable = IsEditableStatus(x.Status)
            });
        }

        public async Task<PagedResponse<OtFormListItemDto>> GetPendingApprovalsAsync(
            string approverUserName, bool isGeneralDirector, int pageIndex, int pageSize)
        {
            var scopes = await _unitOfWork.UserApprovalScopes.FindAsync(x => !x.IsDeleted && x.UserName == approverUserName);

            var deptManagerDepartmentIds = scopes
                .Where(s => s.ApprovalLevel == (int)ApprovalLevel.DepartmentManager && s.ScopeType == (int)ScopeType.Department)
                .Select(s => s.ScopeId).ToList();
            var deptManagerGroupIds = scopes
                .Where(s => s.ApprovalLevel == (int)ApprovalLevel.DepartmentManager && s.ScopeType == (int)ScopeType.Group)
                .Select(s => s.ScopeId).ToList();
            var workshopManagerDepartmentIds = scopes
                .Where(s => s.ApprovalLevel == (int)ApprovalLevel.WorkshopManager && s.ScopeType == (int)ScopeType.Department)
                .Select(s => s.ScopeId).ToList();
            var workshopManagerGroupIds = scopes
                .Where(s => s.ApprovalLevel == (int)ApprovalLevel.WorkshopManager && s.ScopeType == (int)ScopeType.Group)
                .Select(s => s.ScopeId).ToList();

            var query = _unitOfWork.OtForms.GetQueryable(false, x => x.Group, x => x.Department, x => x.OtCase)
                .Where(x => !x.IsDeleted && (
                    (x.Status == (int)OtFormStatus.Pending &&
                        (deptManagerDepartmentIds.Contains(x.DepartmentId) || deptManagerGroupIds.Contains(x.GroupId))) ||
                    (x.Status == (int)OtFormStatus.ApprovedByDepartment &&
                        (workshopManagerDepartmentIds.Contains(x.DepartmentId) || workshopManagerGroupIds.Contains(x.GroupId))) ||
                    (isGeneralDirector && x.Status == (int)OtFormStatus.ApprovedByWorkshop)
                ))
                .OrderBy(x => x.Date);

            return await _unitOfWork.OtForms.ToPagedResponseAsync(query, pageIndex, pageSize, x => new OtFormListItemDto
            {
                Id = x.Id,
                GroupNameVn = x.Group.GroupNameVn,
                DepartmentNameVn = x.Department.DepartmentNameVn,
                OtCaseCode = x.OtCase.Code,
                Date = x.Date,
                TotalHour = x.TotalHour,
                NumberOfEmployee = x.NumberOfEmployee,
                CreatedByUserName = x.CreatedByUserName,
                CreatedByFullName = x.CreatedByFullName,
                Status = x.Status,
                IsEditable = IsEditableStatus(x.Status)
            });
        }

        public async Task<OtFormDto> GetByIdAsync(int id)
        {
            var otForm = await _unitOfWork.OtForms.FirstOrDefaultAsync(x => x.Id == id && !x.IsDeleted,
                x => x.Group, x => x.Department, x => x.Reason, x => x.OtCase);
            otForm.OrThrowNotFound("Đơn tăng ca", id);

            var employees = await _unitOfWork.OtFormEmployees.FindWithIncludesAsync(
                x => x.OtFormId == id, x => x.Employee);

            var processPart = await _unitOfWork.ProcessParts.FirstOrDefaultAsync(x => x.OtFormId == id);

            var histories = await _unitOfWork.OtFormApprovalHistories.FindAsync(x => x.OtFormId == id);

            return new OtFormDto
            {
                Id = otForm!.Id,
                GroupId = otForm.GroupId,
                GroupNameVn = otForm.Group.GroupNameVn,
                DepartmentId = otForm.DepartmentId,
                DepartmentNameVn = otForm.Department.DepartmentNameVn,
                ReasonId = otForm.ReasonId,
                ReasonNameVn = otForm.Reason.ReasonNameVn,
                OtCaseId = otForm.OtCaseId,
                OtCaseCode = otForm.OtCase.Code,
                StartTime = otForm.StartTime,
                EndTime = otForm.EndTime,
                SubReason = otForm.SubReason,
                TotalHour = otForm.TotalHour,
                Date = otForm.Date,
                NumberOfEmployee = otForm.NumberOfEmployee,
                CreatedByUserName = otForm.CreatedByUserName,
                CreatedByFullName = otForm.CreatedByFullName,
                Status = otForm.Status,
                IsEditable = IsEditableStatus(otForm.Status),
                Employees = employees.Select(x => new OtFormEmployeeDto
                {
                    EmployeeId = x.EmployeeId,
                    EmployeeCode = x.Employee.Code,
                    FullName = $"{x.Employee.LastName} {x.Employee.FirstName}",
                    StartTime = x.StartTime,
                    EndTime = x.EndTime,
                    NoteVn = x.NoteVn,
                    NoteJp = x.NoteJp,
                    MonthToDate = x.Employee.MonthToDate,
                    YearToDate = x.Employee.YearToDate,
                    IsEligibleForMeal = (decimal)(x.EndTime - x.StartTime).TotalHours > MinHoursForMealTicket
                }).ToList(),
                ProcessPart = processPart == null ? null : new ProcessPartDto
                {
                    IsEat = processPart.IsEat,
                    MainTicketCount = processPart.MainTicketCount,
                    SecondaryTicketCount = processPart.SecondaryTicketCount,
                    MilkCount = processPart.MilkCount,
                    IsTransportation = processPart.IsTransportation,
                    IsUseCopyRoom = processPart.IsUseCopyRoom,
                    AnotherSuggestionVn = processPart.AnotherSuggestionVn,
                    AnotherSuggestionJp = processPart.AnotherSuggestionJp
                },
                ApprovalHistories = histories
                    .OrderBy(x => x.ActionAt)
                    .Select(x => new OtFormApprovalHistoryDto
                    {
                        ApproverUserName = x.ApproverUserName,
                        ApproverFullName = x.ApproverFullName,
                        ApprovalLevel = x.ApprovalLevel,
                        Action = x.Action,
                        Comment = x.Comment,
                        HasSignature = x.SignatureImage != null,
                        SignatureImage = x.SignatureImage,
                        ActionAt = x.ActionAt
                    }).ToList()
            };
        }

        public async Task<OtFormDto> CreateAsync(string createdByUserName, string? createdByFullName, bool isAdmin, CreateOtFormDto request)
        {
            var group = await _unitOfWork.Groups.FirstOrDefaultAsync(x => x.Id == request.GroupId && !x.IsDeleted);
            group.OrThrowNotFound("Nhóm", request.GroupId);

            var department = await _unitOfWork.Departments.FirstOrDefaultAsync(x => x.Id == request.DepartmentId && !x.IsDeleted);
            department.OrThrowNotFound("Bộ phận", request.DepartmentId);

            var reason = await _unitOfWork.Reasons.FirstOrDefaultAsync(x => x.Id == request.ReasonId && !x.IsDeleted);
            reason.OrThrowNotFound("Lý do", request.ReasonId);

            var otCase = await _unitOfWork.OtCases.FirstOrDefaultAsync(x => x.Id == request.OtCaseId && !x.IsDeleted);
            otCase.OrThrowNotFound("Trường hợp OT", request.OtCaseId);

            // Phạm vi tạo đơn: nhiều người trong cùng Group đều có thể tạo đơn (không chỉ 1 Trưởng Group
            // duy nhất) — gán qua UserApprovalScope với ApprovalLevel=Submitter, cùng cơ chế Group/Department
            // scope đang dùng cho cấp duyệt (xem docs/attendance-module.md). Admin bypass, giống GeneralDirector bypass lúc duyệt.
            if (!isAdmin)
            {
                var creatorScopes = await _unitOfWork.UserApprovalScopes.FindAsync(x =>
                    !x.IsDeleted && x.UserName == createdByUserName && x.ApprovalLevel == (int)ApprovalLevel.Submitter);

                var authorizedToCreate = creatorScopes.Any(s =>
                    (s.ScopeType == (int)ScopeType.Department && s.ScopeId == request.DepartmentId) ||
                    (s.ScopeType == (int)ScopeType.Group && s.ScopeId == request.GroupId));

                if (!authorizedToCreate)
                    throw new DomainException("Bạn không được phân quyền tạo đơn cho nhóm/bộ phận này. Liên hệ Admin để được gán qua UserApprovalScope (ApprovalLevel=Submitter).");
            }

            await ValidateEmployeesAsync(request.GroupId, request.StartTime, request.EndTime, request.Employees);

            var newOtForm = new OtForm
            {
                GroupId = request.GroupId,
                DepartmentId = request.DepartmentId,
                ReasonId = request.ReasonId,
                OtCaseId = request.OtCaseId,
                StartTime = request.StartTime,
                EndTime = request.EndTime,
                SubReason = request.SubReason,
                TotalHour = request.TotalHour,
                Date = request.Date,
                NumberOfEmployee = request.Employees.Count,
                CreatedByUserName = createdByUserName,
                CreatedByFullName = createdByFullName,
                // Chỉ là Draft — CHƯA có chữ ký "Người đề nghị". Trưởng nhóm phải tự gọi
                // POST /{id}/submit để ký duyệt thì đơn mới chuyển sang Pending (chờ Trưởng phòng)
                // (xem docs/attendance-module.md — người tạo đơn khác với người chịu trách nhiệm ký).
                Status = (int)OtFormStatus.Draft,
                IsDeleted = false
            };

            await _unitOfWork.OtForms.AddAsync(newOtForm);

            foreach (var item in request.Employees)
            {
                await _unitOfWork.OtFormEmployees.AddAsync(new OtFormEmployee
                {
                    OtForm = newOtForm,
                    EmployeeId = item.EmployeeId,
                    StartTime = request.StartTime,
                    EndTime = item.EndTime,
                    NoteVn = item.NoteVn,
                    NoteJp = item.NoteJp
                });
            }

            if (request.ProcessPart != null)
            {
                await _unitOfWork.ProcessParts.AddAsync(new ProcessPart
                {
                    OtForm = newOtForm,
                    IsEat = request.ProcessPart.IsEat,
                    MainTicketCount = request.ProcessPart.MainTicketCount,
                    SecondaryTicketCount = request.ProcessPart.SecondaryTicketCount,
                    MilkCount = request.ProcessPart.MilkCount,
                    IsTransportation = request.ProcessPart.IsTransportation,
                    IsUseCopyRoom = request.ProcessPart.IsUseCopyRoom,
                    AnotherSuggestionVn = request.ProcessPart.AnotherSuggestionVn,
                    AnotherSuggestionJp = request.ProcessPart.AnotherSuggestionJp
                });
            }

            await _unitOfWork.SaveChangesAsync();

            // Đơn mới ở trạng thái Draft, cần Trưởng nhóm ký duyệt trước tiên (POST /{id}/submit) —
            // gửi email kèm link Duyệt/Từ chối cho mọi người đủ quyền (kênh bổ sung, không thay thế nút trong app).
            await NotifyEligibleApproversAsync(newOtForm, ApprovalLevel.Submitter);

            return await GetByIdAsync(newOtForm.Id);
        }

        // Trưởng nhóm ký duyệt "Người đề nghị" — chuyển đơn từ Draft sang Pending (chờ Trưởng phòng).
        // Tách riêng khỏi CreateAsync vì người tạo đơn (data entry) không nhất thiết là Trưởng nhóm;
        // chữ ký "Người đề nghị" luôn phải là chữ ký thật của Trưởng nhóm (xem docs/attendance-module.md).
        public async Task<OtFormDto> ApproveSubmitterAsync(int id, string approverUserName, string? approverFullName, bool isAdmin, ApproveOtFormDto request)
        {
            var otForm = await _unitOfWork.OtForms.FirstOrDefaultAsync(x => x.Id == id && !x.IsDeleted);
            otForm.OrThrowNotFound("Đơn tăng ca", id);

            if (otForm!.Status != (int)OtFormStatus.Draft)
                throw new DomainException("Đơn không ở trạng thái nháp (Draft), không thể ký duyệt cấp Trưởng nhóm nữa.");

            // Cùng cơ chế Scope với CreateAsync — chỉ Trưởng nhóm được gán UserApprovalScope(Submitter)
            // khớp đúng Group/Department của đơn mới được ký duyệt. Admin bypass.
            if (!isAdmin)
            {
                var approverScopes = await _unitOfWork.UserApprovalScopes.FindAsync(x =>
                    !x.IsDeleted && x.UserName == approverUserName && x.ApprovalLevel == (int)ApprovalLevel.Submitter);

                var authorized = approverScopes.Any(s =>
                    (s.ScopeType == (int)ScopeType.Department && s.ScopeId == otForm.DepartmentId) ||
                    (s.ScopeType == (int)ScopeType.Group && s.ScopeId == otForm.GroupId));

                if (!authorized)
                    throw new DomainException("Bạn không được phân quyền ký duyệt (cấp Trưởng nhóm) cho nhóm/bộ phận của đơn này.");
            }

            // Chữ ký "Người đề nghị" luôn bắt buộc, lấy từ chữ ký đã đăng ký sẵn (UserSignature) của
            // chính Trưởng nhóm đang ký — không nhận ảnh chữ ký từ request (xem docs/attendance-module.md).
            var submitterSignature = await _unitOfWork.UserSignatures.FirstOrDefaultAsync(x => x.UserName == approverUserName);
            if (submitterSignature == null)
                throw new DomainException("Bạn chưa đăng ký chữ ký. Vui lòng đăng ký chữ ký (PUT /api/UserSignature/me) trước khi ký duyệt.");

            await _unitOfWork.OtFormApprovalHistories.AddAsync(new OtFormApprovalHistory
            {
                OtFormId = otForm.Id,
                ApproverUserName = approverUserName,
                ApproverFullName = approverFullName,
                ApprovalLevel = (int)ApprovalLevel.Submitter,
                Action = (int)ApprovalAction.Submitted,
                Comment = request.Comment,
                SignatureImage = submitterSignature.SignatureImage,
                ActionAt = DateTime.UtcNow
            });

            otForm.Status = (int)OtFormStatus.Pending;
            _unitOfWork.OtForms.Update(otForm);

            await _unitOfWork.SaveChangesAsync();

            // Đơn đã có chữ ký Trưởng nhóm, giờ cần Trưởng phòng (DepartmentManager) duyệt tiếp.
            await NotifyEligibleApproversAsync(otForm, ApprovalLevel.DepartmentManager);

            return await GetByIdAsync(otForm.Id);
        }

        // Sửa toàn bộ đơn (danh mục + nhân viên + ProcessPart) — chỉ chính người tạo mới sửa được,
        // và chỉ khi đơn còn Pending (chưa cấp nào duyệt). Qua cấp nào rồi thì khóa cứng (xem docs).
        public async Task<OtFormDto> UpdateAsync(int id, string currentUserName, UpdateOtFormDto request)
        {
            var otForm = await _unitOfWork.OtForms.FirstOrDefaultAsync(x => x.Id == id && !x.IsDeleted,
                x => x.OtFormEmployees, x => x.ProcessPart);
            otForm.OrThrowNotFound("Đơn tăng ca", id);

            if (otForm!.CreatedByUserName != currentUserName)
                throw new DomainException("Bạn chỉ có thể sửa đơn do chính mình tạo.");

            if (!IsEditableStatus(otForm.Status))
                throw new DomainException("Đơn đã được Trưởng phòng duyệt trở lên, không thể sửa nữa.");

            var group = await _unitOfWork.Groups.FirstOrDefaultAsync(x => x.Id == request.GroupId && !x.IsDeleted);
            group.OrThrowNotFound("Nhóm", request.GroupId);

            var department = await _unitOfWork.Departments.FirstOrDefaultAsync(x => x.Id == request.DepartmentId && !x.IsDeleted);
            department.OrThrowNotFound("Bộ phận", request.DepartmentId);

            var reason = await _unitOfWork.Reasons.FirstOrDefaultAsync(x => x.Id == request.ReasonId && !x.IsDeleted);
            reason.OrThrowNotFound("Lý do", request.ReasonId);

            var otCase = await _unitOfWork.OtCases.FirstOrDefaultAsync(x => x.Id == request.OtCaseId && !x.IsDeleted);
            otCase.OrThrowNotFound("Trường hợp OT", request.OtCaseId);

            await ValidateEmployeesAsync(request.GroupId, request.StartTime, request.EndTime, request.Employees);

            otForm.GroupId = request.GroupId;
            otForm.DepartmentId = request.DepartmentId;
            otForm.ReasonId = request.ReasonId;
            otForm.OtCaseId = request.OtCaseId;
            otForm.StartTime = request.StartTime;
            otForm.EndTime = request.EndTime;
            otForm.SubReason = request.SubReason;
            otForm.TotalHour = request.TotalHour;
            otForm.Date = request.Date;
            otForm.NumberOfEmployee = request.Employees.Count;

            // Diff thay vì xóa hết rồi thêm lại: xóa/thêm cùng EmployeeId trong 1 SaveChanges sẽ đụng
            // trùng khóa kép (OtFormId, EmployeeId) đang được track — nhân viên còn giữ lại thì UPDATE tại chỗ.
            var existingByEmployeeId = otForm.OtFormEmployees.ToDictionary(x => x.EmployeeId);
            var requestedEmployeeIds = request.Employees.Select(x => x.EmployeeId).ToHashSet();

            var toRemove = otForm.OtFormEmployees.Where(x => !requestedEmployeeIds.Contains(x.EmployeeId)).ToList();
            _unitOfWork.OtFormEmployees.RemoveRange(toRemove);

            foreach (var item in request.Employees)
            {
                if (existingByEmployeeId.TryGetValue(item.EmployeeId, out var existing))
                {
                    existing.StartTime = request.StartTime;
                    existing.EndTime = item.EndTime;
                    existing.NoteVn = item.NoteVn;
                    existing.NoteJp = item.NoteJp;
                    _unitOfWork.OtFormEmployees.Update(existing);
                }
                else
                {
                    await _unitOfWork.OtFormEmployees.AddAsync(new OtFormEmployee
                    {
                        OtFormId = otForm.Id,
                        EmployeeId = item.EmployeeId,
                        StartTime = request.StartTime,
                        EndTime = item.EndTime,
                        NoteVn = item.NoteVn,
                        NoteJp = item.NoteJp
                    });
                }
            }

            if (otForm.ProcessPart != null)
            {
                if (request.ProcessPart == null)
                {
                    _unitOfWork.ProcessParts.Delete(otForm.ProcessPart);
                }
                else
                {
                    otForm.ProcessPart.IsEat = request.ProcessPart.IsEat;
                    otForm.ProcessPart.MainTicketCount = request.ProcessPart.MainTicketCount;
                    otForm.ProcessPart.SecondaryTicketCount = request.ProcessPart.SecondaryTicketCount;
                    otForm.ProcessPart.MilkCount = request.ProcessPart.MilkCount;
                    otForm.ProcessPart.IsTransportation = request.ProcessPart.IsTransportation;
                    otForm.ProcessPart.IsUseCopyRoom = request.ProcessPart.IsUseCopyRoom;
                    otForm.ProcessPart.AnotherSuggestionVn = request.ProcessPart.AnotherSuggestionVn;
                    otForm.ProcessPart.AnotherSuggestionJp = request.ProcessPart.AnotherSuggestionJp;
                    _unitOfWork.ProcessParts.Update(otForm.ProcessPart);
                }
            }
            else if (request.ProcessPart != null)
            {
                await _unitOfWork.ProcessParts.AddAsync(new ProcessPart
                {
                    OtFormId = otForm.Id,
                    IsEat = request.ProcessPart.IsEat,
                    MainTicketCount = request.ProcessPart.MainTicketCount,
                    SecondaryTicketCount = request.ProcessPart.SecondaryTicketCount,
                    MilkCount = request.ProcessPart.MilkCount,
                    IsTransportation = request.ProcessPart.IsTransportation,
                    IsUseCopyRoom = request.ProcessPart.IsUseCopyRoom,
                    AnotherSuggestionVn = request.ProcessPart.AnotherSuggestionVn,
                    AnotherSuggestionJp = request.ProcessPart.AnotherSuggestionJp
                });
            }

            _unitOfWork.OtForms.Update(otForm);
            await _unitOfWork.SaveChangesAsync();

            return await GetByIdAsync(otForm.Id);
        }

        public async Task ApproveAsync(int id, string approverUserName, string? approverFullName, bool isGeneralDirector, ApproveOtFormDto request)
        {
            var (otForm, currentLevel) = await LoadFormAndValidateAuthorityAsync(id, approverUserName, isGeneralDirector);

            // Chữ ký cấp duyệt lấy từ chữ ký đã đăng ký sẵn (UserSignature) của người duyệt — không nhận
            // ảnh chữ ký từ request nữa (xem docs/attendance-module.md).
            var approverSignature = await _unitOfWork.UserSignatures.FirstOrDefaultAsync(x => x.UserName == approverUserName);
            if (otForm.OtCase.RequireSignature && approverSignature == null)
                throw new DomainException("Trường hợp OT này bắt buộc phải ký khi duyệt. Vui lòng đăng ký chữ ký (PUT /api/UserSignature/me) trước.");

            await _unitOfWork.OtFormApprovalHistories.AddAsync(new OtFormApprovalHistory
            {
                OtFormId = otForm.Id,
                ApproverUserName = approverUserName,
                ApproverFullName = approverFullName,
                ApprovalLevel = (int)currentLevel,
                Action = (int)ApprovalAction.Approved,
                Comment = request.Comment,
                SignatureImage = approverSignature?.SignatureImage,
                ActionAt = DateTime.UtcNow
            });

            var nextStatus = DetermineNextStatus(currentLevel, (ApprovalLevel)otForm.OtCase.RequiredApprovalLevel);
            otForm.Status = (int)nextStatus;
            _unitOfWork.OtForms.Update(otForm);

            // Chỉ cộng lũy kế 1 lần duy nhất khi đơn đi hết luồng duyệt (Completed) — tránh cộng
            // trùng qua các cấp trung gian và tránh phải rollback lũy kế nếu đơn bị Reject giữa chừng.
            if (nextStatus == OtFormStatus.Completed)
            {
                await AccumulateEmployeeHoursAsync(otForm);
            }

            await _unitOfWork.SaveChangesAsync();

            // Còn cấp tiếp theo cần duyệt (chưa Completed) thì gửi email cho cấp đó — Completed/
            // Rejected thì thôi, không còn ai cần duyệt tiếp nữa.
            if (nextStatus == OtFormStatus.ApprovedByDepartment)
                await NotifyEligibleApproversAsync(otForm, ApprovalLevel.WorkshopManager);
            else if (nextStatus == OtFormStatus.ApprovedByWorkshop)
                await NotifyEligibleApproversAsync(otForm, ApprovalLevel.GeneralDirector);
        }

        public async Task RejectAsync(int id, string approverUserName, string? approverFullName, bool isGeneralDirector, RejectOtFormDto request)
        {
            var (otForm, currentLevel) = await LoadFormAndValidateAuthorityAsync(id, approverUserName, isGeneralDirector);

            await _unitOfWork.OtFormApprovalHistories.AddAsync(new OtFormApprovalHistory
            {
                OtFormId = otForm.Id,
                ApproverUserName = approverUserName,
                ApproverFullName = approverFullName,
                ApprovalLevel = (int)currentLevel,
                Action = (int)ApprovalAction.Rejected,
                Comment = request.Comment,
                ActionAt = DateTime.UtcNow
            });

            otForm.Status = (int)OtFormStatus.Rejected;

            _unitOfWork.OtForms.Update(otForm);
            await _unitOfWork.SaveChangesAsync();
        }

        // === Xác thực qua email (kênh bổ sung cho Duyệt/Từ chối trong app) ===

        public async Task<OtFormDto> GetByEmailTokenAsync(string token)
        {
            var emailToken = await ResolveEmailTokenAsync(token, requireUnused: false);
            return await GetByIdAsync(emailToken.OtFormId);
        }

        public async Task ApproveByEmailTokenAsync(string token, ApproveOtFormDto request)
        {
            var emailToken = await ResolveEmailTokenAsync(token, requireUnused: true);

            // Cấp Submitter (Trưởng nhóm ký duyệt Draft) đi qua nhánh xử lý riêng — không có khái
            // niệm isGeneralDirector/isAdmin qua kênh email (xem docs/attendance-module.md).
            if ((ApprovalLevel)emailToken.ApprovalLevel == ApprovalLevel.Submitter)
            {
                await ApproveSubmitterAsync(emailToken.OtFormId, emailToken.ApproverUserName, emailToken.ApproverFullName, isAdmin: false, request);
            }
            else
            {
                var isGeneralDirector = emailToken.ApprovalLevel == (int)ApprovalLevel.GeneralDirector;
                await ApproveAsync(emailToken.OtFormId, emailToken.ApproverUserName, emailToken.ApproverFullName, isGeneralDirector, request);
            }

            emailToken.UsedAt = DateTime.UtcNow;
            _unitOfWork.OtFormApprovalEmailTokens.Update(emailToken);
            await _unitOfWork.SaveChangesAsync();
        }

        public async Task RejectByEmailTokenAsync(string token, RejectOtFormDto request)
        {
            var emailToken = await ResolveEmailTokenAsync(token, requireUnused: true);
            var isGeneralDirector = emailToken.ApprovalLevel == (int)ApprovalLevel.GeneralDirector;

            await RejectAsync(emailToken.OtFormId, emailToken.ApproverUserName, emailToken.ApproverFullName, isGeneralDirector, request);

            emailToken.UsedAt = DateTime.UtcNow;
            _unitOfWork.OtFormApprovalEmailTokens.Update(emailToken);
            await _unitOfWork.SaveChangesAsync();
        }

        private async Task<OtFormApprovalEmailToken> ResolveEmailTokenAsync(string token, bool requireUnused)
        {
            var emailToken = await _unitOfWork.OtFormApprovalEmailTokens.FirstOrDefaultAsync(x => x.Token == token);
            emailToken.OrThrowNotFound("Link duyệt đơn qua email", token);

            if (emailToken!.ExpiresAt < DateTime.UtcNow)
                throw new DomainException("Link duyệt đơn qua email đã hết hạn.");

            if (requireUnused && emailToken.UsedAt != null)
                throw new DomainException("Link duyệt đơn này đã được sử dụng.");

            return emailToken;
        }

        // Gửi email kèm link Duyệt/Từ chối cho mọi người đủ quyền duyệt ở đúng cấp `level` của đơn
        // `otForm` — gọi sau CreateAsync (luôn cần DepartmentManager) và sau ApproveAsync (còn cấp
        // tiếp theo). Không throw nếu thiếu Email/SMTP lỗi — thông báo chỉ là kênh bổ sung.
        private async Task NotifyEligibleApproversAsync(OtForm otForm, ApprovalLevel level)
        {
            var approverUserNames = await ResolveEligibleApproverUserNamesAsync(level, otForm.DepartmentId, otForm.GroupId);
            if (approverUserNames.Count == 0) return;

            var baseUrl = _configuration["AppSettings:FrontendBaseUrl"];
            var now = DateTime.UtcNow;
            var hasNewToken = false;

            foreach (var approverUserName in approverUserNames)
            {
                var (email, fullName) = await _userDirectoryService.GetContactInfoAsync(approverUserName);
                if (string.IsNullOrWhiteSpace(email)) continue;

                var emailToken = new OtFormApprovalEmailToken
                {
                    OtFormId = otForm.Id,
                    ApproverUserName = approverUserName,
                    ApproverFullName = fullName,
                    ApprovalLevel = (int)level,
                    Token = TokenHelper.GenerateSecureToken(),
                    ExpiresAt = now.AddDays(EmailApprovalTokenExpiryDays),
                    CreatedAt = now
                };
                await _unitOfWork.OtFormApprovalEmailTokens.AddAsync(emailToken);
                hasNewToken = true;

                var link = $"{baseUrl}/xac-nhan-don?token={emailToken.Token}";

                // Render template lỗi không được làm hỏng nghiệp vụ chính (tạo/duyệt đơn vẫn phải
                // thành công) — cùng nguyên tắc với EmailService.SendAsync nuốt lỗi SMTP.
                try
                {
                    var html = _emailTemplateRenderer.Render("OtForm/ApprovalNotification.html", new Dictionary<string, string>
                    {
                        ["OtFormId"] = otForm.Id.ToString(),
                        ["ConfirmLink"] = link,
                        ["ExpiryDays"] = EmailApprovalTokenExpiryDays.ToString()
                    });

                    await _emailService.SendAsync(email, $"Đơn tăng ca #{otForm.Id} đang chờ bạn duyệt - YevManagement", html);
                }
                catch (FileNotFoundException)
                {
                    // Thiếu file template là lỗi triển khai (deploy quên copy EmailTemplates/), bỏ qua
                    // gửi mail cho người này chứ không chặn cả luồng thông báo.
                }
            }

            if (hasNewToken)
                await _unitOfWork.SaveChangesAsync();
        }

        // DepartmentManager/WorkshopManager: tra theo UserApprovalScope khớp Department/Group của
        // đơn (tái dùng cùng logic khớp scope với LoadFormAndValidateAuthorityAsync, chỉ đổi chiều
        // truy vấn — ở đây tìm TẤT CẢ user khớp thay vì kiểm tra 1 user cụ thể).
        // GeneralDirector: không có UserApprovalScope, lấy toàn bộ user đang giữ Role tương ứng.
        private async Task<List<string>> ResolveEligibleApproverUserNamesAsync(ApprovalLevel level, int departmentId, int groupId)
        {
            if (level == ApprovalLevel.GeneralDirector)
                return await _userDirectoryService.GetUserNamesInRoleAsync(GeneralDirectorRoleName);

            var scopes = await _unitOfWork.UserApprovalScopes.FindAsync(x =>
                !x.IsDeleted && x.ApprovalLevel == (int)level &&
                ((x.ScopeType == (int)ScopeType.Department && x.ScopeId == departmentId) ||
                 (x.ScopeType == (int)ScopeType.Group && x.ScopeId == groupId)));

            return scopes.Select(s => s.UserName).Distinct().ToList();
        }

        // Load nhân viên theo Id, chặn nhân viên không tồn tại/khác nhóm, và validate giờ kết thúc
        // từng người: StartTime luôn = giờ bắt đầu của đơn (không nhận từ FE), EndTime phải sau
        // StartTime và không được vượt quá EndTime của đơn (giờ khai báo ở đầu form là TỐI ĐA).
        private async Task<List<Employee>> ValidateEmployeesAsync(
            int groupId, TimeOnly formStartTime, TimeOnly formEndTime, List<CreateOtFormEmployeeItemDto> items)
        {
            var employeeIds = items.Select(x => x.EmployeeId).ToList();
            var employees = await _unitOfWork.Employees.FindAsync(x => employeeIds.Contains(x.Id) && !x.IsDeleted);
            if (employees.Count != employeeIds.Distinct().Count())
                throw new DomainException("Có nhân viên không tồn tại hoặc đã bị xóa trong danh sách.");

            var wrongGroupEmployee = employees.FirstOrDefault(x => x.GroupId != groupId);
            if (wrongGroupEmployee != null)
                throw new DomainException($"Nhân viên '{wrongGroupEmployee.Code}' không thuộc nhóm đã chọn.");

            var employeeById = employees.ToDictionary(x => x.Id);
            foreach (var item in items)
            {
                if (item.EndTime <= formStartTime || item.EndTime > formEndTime)
                {
                    var code = employeeById[item.EmployeeId].Code;
                    throw new DomainException(
                        $"Giờ kết thúc OT của nhân viên '{code}' phải sau giờ bắt đầu ({formStartTime:HH:mm}) " +
                        $"và không được vượt quá giờ kết thúc của đơn ({formEndTime:HH:mm}).");
                }
            }

            return employees.ToList();
        }

        // Cộng giờ OT thực tế của từng nhân viên (EndTime - StartTime) vào lũy kế tháng/năm, tự động
        // rollover về 0 khi Date của đơn rơi sang tháng/năm mới so với Employee.AccumulationYear/Month.
        private async Task AccumulateEmployeeHoursAsync(OtForm otForm)
        {
            var otFormEmployees = await _unitOfWork.OtFormEmployees.FindWithIncludesAsync(
                x => x.OtFormId == otForm.Id, x => x.Employee);

            foreach (var otFormEmployee in otFormEmployees)
            {
                var employee = otFormEmployee.Employee;
                var hours = (decimal)(otFormEmployee.EndTime - otFormEmployee.StartTime).TotalHours;

                if (employee.AccumulationYear != otForm.Date.Year)
                {
                    employee.YearToDate = 0;
                    employee.AccumulationYear = otForm.Date.Year;
                    employee.MonthToDate = 0;
                    employee.AccumulationMonth = otForm.Date.Month;
                }
                else if (employee.AccumulationMonth != otForm.Date.Month)
                {
                    employee.MonthToDate = 0;
                    employee.AccumulationMonth = otForm.Date.Month;
                }

                employee.MonthToDate += hours;
                employee.YearToDate += hours;

                _unitOfWork.Employees.Update(employee);
            }
        }

        private async Task<(OtForm otForm, ApprovalLevel currentLevel)> LoadFormAndValidateAuthorityAsync(
            int id, string approverUserName, bool isGeneralDirector)
        {
            var otForm = await _unitOfWork.OtForms.FirstOrDefaultAsync(x => x.Id == id && !x.IsDeleted, x => x.OtCase);
            otForm.OrThrowNotFound("Đơn tăng ca", id);

            var currentLevel = ((OtFormStatus)otForm!.Status) switch
            {
                OtFormStatus.Draft => throw new DomainException("Đơn đang ở trạng thái nháp, cần Trưởng nhóm ký duyệt (POST /{id}/submit) trước khi duyệt/từ chối ở các cấp tiếp theo."),
                OtFormStatus.Pending => ApprovalLevel.DepartmentManager,
                OtFormStatus.ApprovedByDepartment => ApprovalLevel.WorkshopManager,
                OtFormStatus.ApprovedByWorkshop => ApprovalLevel.GeneralDirector,
                _ => throw new DomainException("Đơn đã xử lý xong (hoàn tất/từ chối), không thể duyệt/từ chối thêm.")
            };

            if (currentLevel == ApprovalLevel.GeneralDirector)
            {
                if (!isGeneralDirector)
                    throw new DomainException("Bạn không có quyền duyệt ở cấp Tổng Giám Đốc.");
            }
            else
            {
                var scopes = await _unitOfWork.UserApprovalScopes.FindAsync(x =>
                    !x.IsDeleted && x.UserName == approverUserName && x.ApprovalLevel == (int)currentLevel);

                var authorized = scopes.Any(s =>
                    (s.ScopeType == (int)ScopeType.Department && s.ScopeId == otForm.DepartmentId) ||
                    (s.ScopeType == (int)ScopeType.Group && s.ScopeId == otForm.GroupId));

                if (!authorized)
                    throw new DomainException("Bạn không được phân quyền duyệt phạm vi (nhóm/bộ phận) của đơn này.");
            }

            return (otForm, currentLevel);
        }

        // Editable ở cả Draft (chưa ai ký) và Pending (đã có chữ ký Trưởng nhóm nhưng Trưởng phòng
        // chưa duyệt) — chỉ khóa cứng khi qua tới cấp Trưởng phòng trở lên (xem docs/attendance-module.md).
        private static bool IsEditableStatus(int status) =>
            status == (int)OtFormStatus.Draft || status == (int)OtFormStatus.Pending;

        private static OtFormStatus DetermineNextStatus(ApprovalLevel justApprovedLevel, ApprovalLevel requiredApprovalLevel)
        {
            if (justApprovedLevel == requiredApprovalLevel) return OtFormStatus.Completed;

            return justApprovedLevel switch
            {
                ApprovalLevel.DepartmentManager => OtFormStatus.ApprovedByDepartment,
                ApprovalLevel.WorkshopManager => OtFormStatus.ApprovedByWorkshop,
                ApprovalLevel.GeneralDirector => OtFormStatus.Completed,
                _ => throw new DomainException("Cấp duyệt không hợp lệ.")
            };
        }
    }
}

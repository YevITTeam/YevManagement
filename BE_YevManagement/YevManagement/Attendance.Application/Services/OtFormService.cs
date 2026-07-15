using Attendance.Application.Dtos.OtForms;
using Attendance.Application.Interfaces.Service;
using Attendance.Domain.Entities;
using Attendance.Domain.Enums;
using Shared.Application.Services;
using Shared.Application.Wrapper;
using Shared.Core.Exceptions;

namespace Attendance.Application.Services
{
    public class OtFormService : BaseService<IAttendanceUnitOfWork>, IOtFormService
    {
        public OtFormService(IAttendanceUnitOfWork unitOfWork) : base(unitOfWork) { }

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
                Status = x.Status
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
                Status = x.Status
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
                Status = otForm.Status,
                Employees = employees.Select(x => new OtFormEmployeeDto
                {
                    EmployeeId = x.EmployeeId,
                    EmployeeCode = x.Employee.Code,
                    FullName = $"{x.Employee.LastName} {x.Employee.FirstName}",
                    StartTime = x.StartTime,
                    EndTime = x.EndTime,
                    NoteVn = x.NoteVn,
                    NoteJp = x.NoteJp
                }).ToList(),
                ProcessPart = processPart == null ? null : new ProcessPartDto
                {
                    IsEat = processPart.IsEat,
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
                        ApprovalLevel = x.ApprovalLevel,
                        Action = x.Action,
                        Comment = x.Comment,
                        HasSignature = x.SignatureImage != null,
                        SignatureImage = x.SignatureImage,
                        ActionAt = x.ActionAt
                    }).ToList()
            };
        }

        public async Task<OtFormDto> CreateAsync(string createdByUserName, CreateOtFormDto request)
        {
            var group = await _unitOfWork.Groups.FirstOrDefaultAsync(x => x.Id == request.GroupId && !x.IsDeleted);
            group.OrThrowNotFound("Nhóm", request.GroupId);

            var department = await _unitOfWork.Departments.FirstOrDefaultAsync(x => x.Id == request.DepartmentId && !x.IsDeleted);
            department.OrThrowNotFound("Bộ phận", request.DepartmentId);

            var reason = await _unitOfWork.Reasons.FirstOrDefaultAsync(x => x.Id == request.ReasonId && !x.IsDeleted);
            reason.OrThrowNotFound("Lý do", request.ReasonId);

            var otCase = await _unitOfWork.OtCases.FirstOrDefaultAsync(x => x.Id == request.OtCaseId && !x.IsDeleted);
            otCase.OrThrowNotFound("Trường hợp OT", request.OtCaseId);

            var employeeIds = request.Employees.Select(x => x.EmployeeId).ToList();
            var employees = await _unitOfWork.Employees.FindAsync(x => employeeIds.Contains(x.Id) && !x.IsDeleted);
            if (employees.Count != employeeIds.Distinct().Count())
                throw new DomainException("Có nhân viên không tồn tại hoặc đã bị xóa trong danh sách.");

            var wrongGroupEmployee = employees.FirstOrDefault(x => x.GroupId != request.GroupId);
            if (wrongGroupEmployee != null)
                throw new DomainException($"Nhân viên '{wrongGroupEmployee.Code}' không thuộc nhóm đã chọn.");

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
                Status = (int)OtFormStatus.Pending,
                IsDeleted = false
            };

            await _unitOfWork.OtForms.AddAsync(newOtForm);

            foreach (var item in request.Employees)
            {
                await _unitOfWork.OtFormEmployees.AddAsync(new OtFormEmployee
                {
                    OtForm = newOtForm,
                    EmployeeId = item.EmployeeId,
                    StartTime = item.StartTime,
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
                    IsTransportation = request.ProcessPart.IsTransportation,
                    IsUseCopyRoom = request.ProcessPart.IsUseCopyRoom,
                    AnotherSuggestionVn = request.ProcessPart.AnotherSuggestionVn,
                    AnotherSuggestionJp = request.ProcessPart.AnotherSuggestionJp
                });
            }

            // Bước 0 bắt buộc: Trưởng Group ký "Người đề nghị" ngay lúc tạo đơn — cùng 1 SaveChangesAsync
            // với OtForm nên atomic với nhau (xem docs/attendance-module.md).
            await _unitOfWork.OtFormApprovalHistories.AddAsync(new OtFormApprovalHistory
            {
                OtForm = newOtForm,
                ApproverUserName = createdByUserName,
                ApprovalLevel = (int)ApprovalLevel.Submitter,
                Action = (int)ApprovalAction.Submitted,
                SignatureImage = request.SubmitterSignatureImage,
                ActionAt = DateTime.UtcNow
            });

            await _unitOfWork.SaveChangesAsync();

            return await GetByIdAsync(newOtForm.Id);
        }

        public async Task ApproveAsync(int id, string approverUserName, bool isGeneralDirector, ApproveOtFormDto request)
        {
            var (otForm, currentLevel) = await LoadFormAndValidateAuthorityAsync(id, approverUserName, isGeneralDirector);

            if (otForm.OtCase.RequireSignature && request.SignatureImage == null)
                throw new DomainException("Trường hợp OT này bắt buộc phải ký khi duyệt.");

            await _unitOfWork.OtFormApprovalHistories.AddAsync(new OtFormApprovalHistory
            {
                OtFormId = otForm.Id,
                ApproverUserName = approverUserName,
                ApprovalLevel = (int)currentLevel,
                Action = (int)ApprovalAction.Approved,
                Comment = request.Comment,
                SignatureImage = request.SignatureImage,
                ActionAt = DateTime.UtcNow
            });

            otForm.Status = (int)DetermineNextStatus(currentLevel, (ApprovalLevel)otForm.OtCase.RequiredApprovalLevel);

            _unitOfWork.OtForms.Update(otForm);
            await _unitOfWork.SaveChangesAsync();
        }

        public async Task RejectAsync(int id, string approverUserName, bool isGeneralDirector, RejectOtFormDto request)
        {
            var (otForm, currentLevel) = await LoadFormAndValidateAuthorityAsync(id, approverUserName, isGeneralDirector);

            await _unitOfWork.OtFormApprovalHistories.AddAsync(new OtFormApprovalHistory
            {
                OtFormId = otForm.Id,
                ApproverUserName = approverUserName,
                ApprovalLevel = (int)currentLevel,
                Action = (int)ApprovalAction.Rejected,
                Comment = request.Comment,
                ActionAt = DateTime.UtcNow
            });

            otForm.Status = (int)OtFormStatus.Rejected;

            _unitOfWork.OtForms.Update(otForm);
            await _unitOfWork.SaveChangesAsync();
        }

        private async Task<(OtForm otForm, ApprovalLevel currentLevel)> LoadFormAndValidateAuthorityAsync(
            int id, string approverUserName, bool isGeneralDirector)
        {
            var otForm = await _unitOfWork.OtForms.FirstOrDefaultAsync(x => x.Id == id && !x.IsDeleted, x => x.OtCase);
            otForm.OrThrowNotFound("Đơn tăng ca", id);

            var currentLevel = ((OtFormStatus)otForm!.Status) switch
            {
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

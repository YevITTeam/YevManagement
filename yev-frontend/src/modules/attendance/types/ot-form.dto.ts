// Schema theo docs/attendance-api-fe.md §4 (đã cập nhật 2026-07-16, đợt 1-3). date: DateOnly
// "yyyy-MM-dd" — startTime/endTime: TimeOnly "HH:mm:ss".

// mainTicketCount/secondaryTicketCount/milkCount (2026-07-16 đợt 3): nhập tay, chung cho cả đơn,
// chỉ có ý nghĩa khi isEat=true — xem §4.1.
export interface ProcessPartDto {
    isEat: boolean;
    mainTicketCount: number;
    secondaryTicketCount: number;
    milkCount: number;
    isTransportation: boolean;
    isUseCopyRoom: boolean;
    anotherSuggestionVn: string | null;
    anotherSuggestionJp: string | null;
}

// employees[].startTime KHÔNG còn tồn tại (bỏ 2026-07-16) — luôn bằng startTime của đơn, BE tự set.
export interface OtFormEmployeeInputDto {
    employeeId: number;
    endTime: string;
    noteVn: string | null;
    noteJp: string | null;
}

// Chi tiết nhân viên trong OtFormDto — monthToDate/yearToDate/isEligibleForMeal là dữ liệu LIVE (§4.3).
// isRemoved trở đi (2026-07-30, §4.5a "Loại nhân viên khỏi đơn"): người bị loại VẪN nằm trong mảng
// employees (không bị BE lọc bỏ) để màn chi tiết hiện được lịch sử ai loại/khi nào/lý do gì — FE tự ẩn
// khỏi bản in và khỏi phần tính tổng giờ OT. numberOfEmployee ở OtFormDto/OtFormListItemDto chỉ đếm
// người CHƯA bị loại.
export interface OtFormEmployeeDto {
    employeeId: number;
    employeeCode: string;
    fullName: string;
    startTime: string;
    endTime: string;
    noteVn: string | null;
    noteJp: string | null;
    monthToDate: number;
    yearToDate: number;
    isEligibleForMeal: boolean;
    isRemoved: boolean;
    removedByUserName: string | null;
    removedByFullName: string | null;
    removedAtLevel: number | null;
    removedAt: string | null;
    removeReason: string | null;
}

// GET /api/OtForm/my-create-scopes — §4.0a, mới 2026-07-17. Bộ phận/Phòng ban mà CHÍNH user gọi
// được phép tạo đơn (suy từ UserApprovalScope(Submitter) hoặc Employee.GroupId). Mảng rỗng = Admin
// (không giới hạn phạm vi) HOẶC tài khoản chưa được cấu hình gì — FE tự phân biệt 2 case này.
export interface MyCreateScopeItemDto {
    groupId: number;
    groupNameVn: string;
    departmentId: number;
    departmentNameVn: string;
}

// Body POST /api/OtForm — §4.1. Không còn field chữ ký (BE tự lấy từ UserSignature/me).
export interface CreateOtFormDto {
    groupId: number;
    departmentId: number;
    reasonId: number;
    otCaseId: number;
    startTime: string;
    endTime: string;
    subReason: string | null;
    totalHour: number;
    date: string;
    employees: OtFormEmployeeInputDto[];
    processPart: ProcessPartDto | null;
}

// Item của UpdateOtFormDto.employees — sửa 2026-07-31: chỉ còn EmployeeId + EndTime (bỏ NoteVn/NoteJp).
export interface UpdateOtFormEmployeeTimeDto {
    employeeId: number;
    endTime: string;
}

// Body PUT /api/OtForm/{id} — §4.1b. Sửa lại 2026-07-31 (breaking): trước đây giống hệt
// CreateOtFormDto (sửa được toàn bộ field + thêm/bớt nhân viên), nay CHỈ còn sửa được giờ kết thúc
// thực tế của từng nhân viên ĐANG có trong đơn — mọi field khác (Group/Department/Reason/OtCase/Date/
// StartTime/EndTime/SubReason/ProcessPart) và việc thêm/bớt người đều bị khoá sau khi tạo đơn (xem
// docs/attendance-module.md — Sửa đơn: giới hạn chỉ sửa thực tích).
export interface UpdateOtFormDto {
    employees: UpdateOtFormEmployeeTimeDto[];
}

// Rút gọn của OtFormApprovalHistoryDto — có mặt trên cả 5 endpoint danh sách (my-forms/
// pending-submissions/pending-approvals/my-actions/my-participations), bỏ comment/signatureImage/
// hasSignature (không cần cho danh sách) — §4.2, mới 2026-07-17.
export interface OtFormApprovalSummaryItemDto {
    approvalLevel: number;
    approverUserName: string;
    approverFullName: string | null;
    action: number;
    actionAt: string;
}

// Item bảng my-forms / pending-approvals — §4.2.
export interface OtFormListItemDto {
    id: number;
    groupNameVn: string;
    groupNameJp: string | null;
    departmentNameVn: string;
    departmentNameJp: string | null;
    otCaseCode: string;
    date: string;
    totalHour: number;
    numberOfEmployee: number;
    createdByUserName: string;
    createdByFullName: string | null;
    status: number;
    isEditable: boolean;
    approvalSummary: OtFormApprovalSummaryItemDto[];
}

// ApprovalAction (docs §2): 0=Submitted, 1=Approved, 2=Rejected.
export interface OtFormApprovalHistoryDto {
    approverUserName: string;
    approverFullName: string | null;
    approvalLevel: number;
    action: number;
    comment: string | null;
    hasSignature: boolean;
    signatureImage: string | null;
    actionAt: string;
}

// Chi tiết GET /api/OtForm/{id} (và GET /OtForm/email-confirm/{token}) — §4.3.
export interface OtFormDto {
    id: number;
    groupId: number;
    groupNameVn: string;
    groupNameJp: string | null;
    departmentId: number;
    departmentNameVn: string;
    departmentNameJp: string | null;
    reasonId: number;
    reasonNameVn: string;
    reasonNameJp: string | null;
    otCaseId: number;
    otCaseCode: string;
    startTime: string;
    endTime: string;
    subReason: string | null;
    totalHour: number;
    date: string;
    numberOfEmployee: number;
    createdByUserName: string;
    createdByFullName: string | null;
    status: number;
    isEditable: boolean;
    employees: OtFormEmployeeDto[];
    processPart: ProcessPartDto | null;
    approvalHistories: OtFormApprovalHistoryDto[];
}

// Body POST /api/OtForm/{id}/approve — §4.4. Không còn signatureImage (BE tự lấy từ UserSignature/me).
// secondaryPassword: mật khẩu cấp 2 của người gọi, BE re-verify trước khi ghi (áp dụng cho CẢ
// submit/approve, xem SecondaryPasswordApi + docs/attendance-module.md — Mật khẩu cấp 2).
export interface ApproveOtFormDto {
    comment: string | null;
    secondaryPassword: string;
}

// Body POST /api/OtForm/{id}/reject — §4.5.
export interface RejectOtFormDto {
    comment: string;
    secondaryPassword: string;
}

// Body POST /api/OtForm/{id}/employees/remove — §4.5a, mới 2026-07-30, sửa 2026-07-31 (bỏ mật khẩu
// cấp 2 — user chốt hành động loại nhân viên không cần xác thực lại, khác Duyệt/Từ chối). Loại 1 nhân
// viên khỏi đơn để duyệt được phần còn lại thay vì từ chối cả đơn — endpoint riêng, tách biệt khỏi
// approve (xem docs/attendance-module.md — Loại nhân viên khỏi đơn).
export interface RemoveOtFormEmployeeDto {
    employeeId: number;
    reason: string;
}

// Body POST /api/OtForm/email-confirm/{token}/employees/remove — §4.5a, mới 2026-07-31. Cùng shape với
// RemoveOtFormEmployeeDto — không endpoint nào yêu cầu mật khẩu cấp 2 cho hành động loại nhân viên.
export interface RemoveOtFormEmployeeByEmailTokenDto {
    employeeId: number;
    reason: string;
}

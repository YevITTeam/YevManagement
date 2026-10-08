// Schema theo docs/attendance-module.md §API (đã cập nhật 2026-07-16, đợt 1-3). date: DateOnly
// "yyyy-MM-dd" — startTime/endTime: TimeOnly "HH:mm:ss".

export interface CheckOtFormOverlapEmployeeDto {
    employeeId: number;
    startTime: string | null;
    endTime: string;
}

export interface CheckOtFormOverlapDto {
    date: string;
    startTime: string;
    employees: CheckOtFormOverlapEmployeeDto[];
    excludeFormId?: number | null;
}

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

// startTime: giờ bắt đầu riêng của từng người, phải nằm trong khoảng giờ của đơn — null = startTime của đơn.
// didEat (mới 2026-08-06): chỉ có ý nghĩa khi giờ OT thực tế của người này >= setting.mainMealTicketMinHours
// — xem §Phiếu ăn. Dưới ngưỡng thì gửi giá trị nào cũng không ảnh hưởng gì (BE bỏ qua).
export interface OtFormEmployeeInputDto {
    employeeId: number;
    startTime: string | null;
    endTime: string;
    didEat: boolean;
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
    // Giới hạn giờ OT/tháng/năm RIÊNG của nhân viên này TẠI THỜI ĐIỂM ĐỌC (live, không snapshot như
    // monthToDate/yearToDate ở trên) — null = dùng mặc định chung (2026-08-26, mirror
    // EmployeeDto.customMonthlyOtHourLimit/customYearlyOtHourLimit).
    customMonthlyOtHourLimit: number | null;
    customYearlyOtHourLimit: number | null;
    // Loại phiếu ăn: 0=Không có phiếu, 1=Phiếu Phụ, 2=Phiếu Chính — redesign 3 bậc (2026-08-26, thay
    // isEligibleForMeal cũ), xem modules/attendance/lib/mealTicket.ts + docs §Phiếu ăn.
    mealTicketType: number;
    // Giờ OT thực tính (2026-08-26) — BE đã trừ sẵn giờ nghỉ ăn nếu có ăn (trừ ca khớp đúng khung sớm,
    // luôn không trừ); không ăn thì bằng đúng endTime-startTime. LUÔN dùng field này để hiển thị/cộng
    // tổng giờ OT của 1 người — KHÔNG tự tính lại bằng calculateHours(startTime, endTime) nữa.
    actualHours: number;
    // Có ăn hay không — mới 2026-08-06, xem §Phiếu ăn. Quyết định actualHours có bị trừ giờ nghỉ ăn hay
    // không (BE tự tính, FE không tự tính) — vẫn có ý nghĩa bất kể mealTicketType, trừ ca khớp đúng
    // khung sớm (luôn bỏ qua).
    didEat: boolean;
    isRemoved: boolean;
    removedByUserName: string | null;
    removedByFullName: string | null;
    // StepOrder của bước duyệt đang xử lý lúc bị loại (đổi ý nghĩa 2026-08-07, Giai đoạn 3.1 — trước
    // đây là ApprovalLevel cũ, giữ nguyên tên field để tương thích).
    removedAtLevel: number | null;
    removedAt: string | null;
    removeReason: string | null;
    // Snapshot ProductionEmployee lúc thêm vào đơn — chỉ có giá trị khi OtFormDto.isProductionForm =
    // true (đơn "theo chuyền"), null cho đơn "theo Nhóm" (2026-08-24).
    congDoanSnapshot: string | null;
    taskNameSnapshot: string | null;
    blockCodeSnapshot: string | null;
    teamCodeSnapshot: string | null;
    shiftTeamCodeSnapshot: string | null;
}

// GET /api/OtForm/my-create-scopes — §4.0a. Bộ phận/Phòng ban mà CHÍNH user gọi được phép tạo đơn
// (suy từ Employee.GroupId của chính user — sửa 2026-08-07, Giai đoạn 3.1, bỏ UserApprovalScope).
// Tối đa 1 phần tử (đúng Group của user). Mảng rỗng = Admin (không giới hạn phạm vi) HOẶC tài khoản
// chưa liên kết Employee nào — FE tự phân biệt 2 case này.
export interface MyCreateScopeItemDto {
    groupId: number;
    groupNameVn: string;
    departmentId: number;
    departmentNameVn: string;
}

// GET /api/OtForm/my-production-create-scopes — (những) tổ hợp Team/Line/Nhóm ca mà CHÍNH user gọi
// đang là Line Leader (suy từ ProductionEmployee.IsLeader, 2026-09-28). Dùng để FE tự điền sẵn + khoá
// cứng 3 dropdown ở chế độ "Theo chuyền" thay vì bắt Line Leader tự chọn lại. Mảng rỗng = Admin (không
// giới hạn) HOẶC người gọi không phải Line Leader của bất kỳ tổ hợp nào — FE giữ dropdown tự do.
export interface MyProductionCreateScopeItemDto {
    // Bộ phận của CHÍNH người gọi — giống nhau ở mọi phần tử của mảng (2026-09-28).
    departmentId: number;
    departmentNameVn: string;
    productionLineId: number;
    lineCode: string;
    lineNameVn: string | null;
    teamId: number;
    teamCode: string;
    teamNameVn: string | null;
    shiftTeamId: number;
    shiftTeamCode: string;
    shiftTeamNameVn: string | null;
}

// Body POST /api/OtForm — §4.1. Không còn field chữ ký (BE tự lấy từ UserSignature/me).
// groupId/isProductionForm (2026-08-24): đơn "theo Nhóm" (mặc định) bắt buộc groupId, isProductionForm
// = false; đơn "theo chuyền" (Chế tạo) groupId = null, isProductionForm = true — xem CreateOtFormPage.tsx.
// secondaryPassword (2026-08-28): mật khẩu cấp 2, BE re-verify trước khi tạo đơn — cùng cơ chế với
// ApproveOtFormDto.secondaryPassword.
export interface CreateOtFormDto {
    groupId: number | null;
    isProductionForm: boolean;
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
    secondaryPassword: string;
}

// Item của UpdateOtFormDto.employees — sửa 2026-07-31: chỉ còn EmployeeId + EndTime (bỏ NoteVn/NoteJp).
// Thêm didEat 2026-08-06 — sửa được cùng lúc với EndTime (xem OtFormEmployeeDto.didEat). noteVn/noteJp
// trở lại 2026-08-27 (Giai đoạn 5) — Group Leader/Team Leader (đơn "theo chuyền") ghi chú trao đổi qua
// từng nhân viên thay vì ghi giấy, xem attendance-module.md §Cây chức vụ & Cây duyệt.
export interface UpdateOtFormEmployeeTimeDto {
    employeeId: number;
    // null = giữ nguyên giờ bắt đầu hiện có của người này.
    startTime: string | null;
    endTime: string;
    didEat: boolean;
    noteVn: string | null;
    noteJp: string | null;
}

// 1 nhân viên bị loại khỏi đơn trong lượt Sửa đơn (2026-09-04) — xem UpdateOtFormDto.removedEmployees.
export interface UpdateOtFormRemovedEmployeeDto {
    employeeId: number;
    reason: string;
}

// Body PUT /api/OtForm/{id} — §4.1b. Sửa lại 2026-09-04 (gộp thêm/xóa nhân viên vào Sửa đơn, thay cho
// 2 action riêng AddOtFormEmployeeDto/RemoveOtFormEmployeeDto trước đó — xem docs/attendance-module.md
// §Cây chức vụ & Cây duyệt (mục Sửa đơn)): mỗi phần tử employees có thể là NGƯỜI CŨ (sửa giờ kết thúc/didEat/
// note) hoặc NGƯỜI MỚI (BE tự suy diff so với danh sách active hiện có) — nhân viên MỚI thêm vào đơn
// dưới chuyền phải cùng Line/Nhóm ca với người còn lại của đơn (BE tự kiểm, FE chỉ nên tự khoá dropdown
// tìm kiếm cho gọn UX). removedEmployees: nhân viên bị loại (bắt buộc kèm lý do) — người đang có trong
// đơn mà KHÔNG có mặt ở cả employees LẪN removedEmployees sẽ bị BE báo lỗi (dữ liệu không hợp lệ). Mọi
// field khác (Group/Department/Reason/OtCase/Date/StartTime/EndTime/SubReason/ProcessPart) vẫn khoá
// sau khi tạo đơn. secondaryPassword: 1 lần cho TOÀN BỘ thay đổi trong lượt lưu này.
export interface UpdateOtFormDto {
    employees: UpdateOtFormEmployeeTimeDto[];
    removedEmployees: UpdateOtFormRemovedEmployeeDto[];
    secondaryPassword: string;
}

// Rút gọn của OtFormApprovalHistoryDto — có mặt trên cả 5 endpoint danh sách (my-forms/
// pending-submissions/pending-approvals/my-actions/my-participations), bỏ comment/signatureImage/
// hasSignature (không cần cho danh sách) — §4.2, sửa 2026-08-07 (Giai đoạn 3.1): approvalLevel →
// stepOrder + jobTitleNameSnapshot (thay cho 5 cấp cố định cũ, xem §Cây chức vụ).
export interface OtFormApprovalSummaryItemDto {
    stepOrder: number;
    jobTitleNameSnapshot: string;
    approverUserName: string;
    approverFullName: string | null;
    action: number;
    actionAt: string;
}

// Item bảng my-forms / pending-approvals — §4.2.
export interface OtFormListItemDto {
    id: number;
    // Null khi đơn "theo chuyền" (isProductionForm = true) — 2026-08-24.
    groupNameVn: string | null;
    groupNameJp: string | null;
    isProductionForm: boolean;
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
    // Số người đủ điều kiện xử lý bước đang chờ HIỆN TẠI (0 nếu không còn InApproval) — >1 nghĩa là
    // "đang chờ 1 trong N người", không phải riêng bạn (2026-08-08, Giai đoạn 3.2).
    currentStepCandidateCount: number;
    // Line/Nhóm ca của đơn theo chuyền (2026-09-04) — distinct, nối bằng ", " (đơn có thể gồm nhiều
    // Line). Null với đơn theo Nhóm.
    productionLineNames: string | null;
    productionShiftTeamNames: string | null;
}

// GET /api/OtForm/pending-approvals/dates — lịch mini ở màn Duyệt hàng loạt (2026-09-04). date:
// DateOnly "yyyy-MM-dd".
export interface PendingApprovalDateCountDto {
    date: string;
    count: number;
}

// ApprovalAction (docs §2): 0=Submitted, 1=Approved, 2=Rejected.
// Sửa 2026-08-07 (Giai đoạn 3.1): approvalLevel → stepOrder + jobTitleNameSnapshot.
export interface OtFormApprovalHistoryDto {
    approverUserName: string;
    approverFullName: string | null;
    // Set when the approver acted by delegation: the delegator they covered.
    onBehalfOfUserName: string | null;
    onBehalfOfFullName: string | null;
    stepOrder: number;
    jobTitleNameSnapshot: string;
    action: number;
    comment: string | null;
    hasSignature: boolean;
    signatureImage: string | null;
    actionAt: string;
}

// 1 người đang giữ đúng Chức vụ của bước này trong Phòng ban lúc snapshot (có thể nhiều người/bước).
export interface OtFormApprovalStepCandidateDto {
    employeeId: number;
    userName: string;
    fullName: string;
}

// Chuỗi bước duyệt đã snapshot lúc tạo đơn (2026-08-07, Giai đoạn 3.1) — xem OtFormDto.approvalSteps.
// status: enum OtFormApprovalStepStatus (0=Pending, 1=Approved, 2=Rejected, 3=Skipped).
// terminalLevelSnapshot: enum JobTitleTerminalLevel (0=None, 1=DepartmentManager, 2=WorkshopManager, 3=GeneralDirector).
export interface OtFormApprovalStepDto {
    id: number;
    stepOrder: number;
    jobTitleCodeSnapshot: string;
    jobTitleNameSnapshot: string;
    requiresSignatureSnapshot: boolean;
    isResponsibleSnapshot: boolean;
    terminalLevelSnapshot: number;
    status: number;
    candidates: OtFormApprovalStepCandidateDto[];
    // Pending steps only: who currently covers a candidate by delegation.
    delegates: OtFormApprovalStepDelegateDto[];
}

export interface OtFormApprovalStepDelegateDto {
    delegatorUserName: string;
    delegateFullName: string;
}

// 1 dòng lịch sử chỉnh sửa đơn (mới 2026-08-28) — actionType: enum OtFormEditActionType
// (0=TimeChanged, 1=NoteChanged, 2=EmployeeAdded, 3=EmployeeRemoved). fieldName null khi
// actionType là EmployeeAdded/EmployeeRemoved (hành động, không phải đổi 1 field cụ thể).
export interface OtFormEditLogDto {
    actionByUserName: string;
    actionByFullName: string | null;
    actionAt: string;
    actionType: number;
    employeeId: number | null;
    employeeCodeSnapshot: string | null;
    fieldName: string | null;
    oldValue: string | null;
    newValue: string | null;
}

// Chi tiết GET /api/OtForm/{id} (và GET /OtForm/email-confirm/{token}) — §4.3.
export interface OtFormDto {
    id: number;
    // Null khi đơn "theo chuyền" (isProductionForm = true) — 2026-08-24, xem OtForm.GroupId.
    groupId: number | null;
    groupNameVn: string | null;
    groupNameJp: string | null;
    isProductionForm: boolean;
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
    // Thời điểm tạo đơn (UTC, ISO) — dùng làm "thời gian ký" khi in cho trường hợp tự ký
    // (creatorSignatureImage không có OtFormApprovalHistory riêng để lấy actionAt), 2026-08-20.
    createdAt: string;
    // base64 — ảnh chữ ký của CHÍNH người tạo đơn, chỉ có giá trị khi người tạo đã ở cấp cao hơn/bằng
    // mọi Chức vụ trung gian "Bắt buộc ký" của Phòng ban (tự ký ô "Người đề nghị", 2026-08-08). Xem
    // OtFormPrintView.tsx.
    creatorSignatureImage: string | null;
    status: number;
    isEditable: boolean;
    // Cảnh báo suy luận chuỗi lúc tạo đơn (null nếu chuỗi đầy đủ) — hiện banner cảnh báo trên UI nếu có.
    approvalChainWarning: string | null;
    employees: OtFormEmployeeDto[];
    processPart: ProcessPartDto | null;
    approvalHistories: OtFormApprovalHistoryDto[];
    // Chuỗi bước duyệt đã snapshot lúc tạo đơn, sắp theo stepOrder.
    approvalSteps: OtFormApprovalStepDto[];
    // Lịch sử chỉnh sửa (sửa giờ/ghi chú, thêm/loại nhân viên) — mới nhất trước, mới 2026-08-28.
    editLogs: OtFormEditLogDto[];
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

// Ký/Từ chối hàng loạt (2026-08-27) — Comment/SecondaryPassword dùng CHUNG cho cả loạt. BE xử lý từng
// đơn ĐỘC LẬP (1 đơn lỗi không huỷ các đơn còn lại) — xem BulkOtFormActionResultItemDto.
export interface BulkApproveOtFormDto {
    otFormIds: number[];
    comment: string | null;
    secondaryPassword: string;
}

export interface BulkRejectOtFormDto {
    otFormIds: number[];
    comment: string;
    secondaryPassword: string;
}

export interface BulkOtFormActionResultItemDto {
    otFormId: number;
    success: boolean;
    error: string | null;
}

// Body POST /api/OtForm/{id}/delete — Admin only (Attendance.OTForm.Delete), 2026-08-08. Xoá đơn kẹt
// vĩnh viễn trong chuỗi duyệt — BE chặn 400 nếu đơn đã Completed (đã cộng lũy kế thật).
export interface DeleteOtFormDto {
    reason: string;
}

// Body POST /api/OtForm/email-confirm/{token}/employees/remove — §4.5a. The email channel re-verifies the secondary password.
export interface RemoveOtFormEmployeeByEmailTokenDto {
    employeeId: number;
    reason: string;
    secondaryPassword: string;
}

// Body POST /api/OtForm/{id}/employees/remove — kênh trong-app (JWT), khôi phục 2026-09-30 ngay trên
// màn Duyệt (§Loại nhân viên khỏi đơn) — TÁCH RIÊNG khỏi UpdateOtFormDto
// (chỉ người tạo mới gọi được cho đơn theo Nhóm): endpoint này dùng đúng luật "candidate bước Pending
// hiện tại" nên approver không phải người tạo cũng loại được. KHÔNG có secondaryPassword (phiên JWT đã xác thực).
export interface RemoveOtFormEmployeeDto {
    employeeId: number;
    reason: string;
}

// Quyền cần có để vào từng trang /ot/* — dùng chung cho menu bên trái (OtManagerSidebar) và chặn vào
// thẳng URL (OtAccessGuard) để hai nơi không lệch nhau. Có 1 TRONG các quyền là vào được. BE vẫn luôn
// enforce lại ở từng API, đây chỉ là lớp ẩn/chặn UI.
export const OT_CATEGORIES_PERMISSIONS = [
    "Attendance.Department.Create",
    "Attendance.Group.Create",
    "Attendance.Reason.Create",
    "Attendance.OtCase.Create",
    "Attendance.JobTitle.Create",
    "Attendance.DepartmentApprovalStep.Update",
    "Attendance.GroupApprovalStep.Update",
    "Attendance.ProductionApprovalStep.Update",
    "Attendance.Employee.Create",
    "Attendance.Employee.Update",
    "Attendance.Employee.Delete",
    "Attendance.Employee.UpdateOtLimit",
    "Attendance.EmployeeAccumulation.Update",
    "Attendance.ProductionEmployee.View",
    "Attendance.Setting.Update",
    "Attendance.ProductionOtReport.View",
];

// Khớp theo tiền tố đường dẫn (không gồm locale); mục đầu tiên khớp sẽ được dùng.
export const OT_ROUTE_PERMISSIONS: { prefix: string; permissions: string[] }[] = [
    { prefix: "/ot/create", permissions: ["Attendance.OTForm.Create"] },
    { prefix: "/ot/ai-chat", permissions: ["Attendance.AiChat.Use"] },
    { prefix: "/ot/list", permissions: ["Attendance.OTForm.View"] },
    { prefix: "/ot/forms", permissions: ["Attendance.OTForm.View"] },
    { prefix: "/ot/batches", permissions: ["Attendance.OTForm.Approve"] },
    { prefix: "/ot/accumulation", permissions: ["Attendance.OTForm.Approve"] },
    { prefix: "/ot/categories", permissions: OT_CATEGORIES_PERMISSIONS },
    { prefix: "/ot/signature", permissions: ["Attendance.UserSignature.Update"] },
    { prefix: "/ot/secondary-password", permissions: ["Attendance.SecondaryPassword.Update"] },
];

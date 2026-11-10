// Shared by OtManagerSidebar and OtAccessGuard so menu and URL guard never diverge; any one permission grants
// access. UI-only gate, BE enforces again.
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
    "Attendance.ProductionCatalog.Manage",
];

// Prefix match without locale; first match wins.
export const OT_ROUTE_PERMISSIONS: { prefix: string; permissions: string[] }[] = [
    // Create and CreateProduction are separate: Line Leaders with only CreateProduction must still reach this page.
    // Manager-and-above is enforced by the API (OtOverview/access); Approve is only the cheap UI gate.
    { prefix: "/ot/overview", permissions: ["Attendance.OTForm.Approve"] },
    { prefix: "/ot/create", permissions: ["Attendance.OTForm.Create", "Attendance.OTForm.CreateProduction"] },
    { prefix: "/ot/ai-chat", permissions: ["Attendance.AiChat.Use"] },
    { prefix: "/ot/list", permissions: ["Attendance.OTForm.View"] },
    { prefix: "/ot/forms", permissions: ["Attendance.OTForm.View"] },
    { prefix: "/ot/delegations", permissions: ["Attendance.OTForm.Delegate"] },
    { prefix: "/ot/paper-scans", permissions: ["Attendance.OTForm.View"] },
    { prefix: "/ot/accumulation", permissions: ["Attendance.OTForm.Approve"] },
    { prefix: "/ot/categories", permissions: OT_CATEGORIES_PERMISSIONS },
    { prefix: "/ot/signature", permissions: ["Attendance.UserSignature.Update"] },
    { prefix: "/ot/secondary-password", permissions: ["Attendance.SecondaryPassword.Update"] },
    { prefix: "/ot/audit-trail", permissions: ["Attendance.AuditTrail.View"] },
];

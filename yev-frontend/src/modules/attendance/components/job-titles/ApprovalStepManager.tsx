"use client";

import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { toast } from "react-toastify";
import { useTranslations } from "next-intl";
import { Check, GripVertical, Plus, Star, Trash2, X } from "lucide-react";

import { DepartmentApprovalStepApi } from "@/modules/attendance/api/department-approval-step.api";
import { GroupApprovalStepApi } from "@/modules/attendance/api/group-approval-step.api";
import { ProductionApprovalStepApi } from "@/modules/attendance/api/production-approval-step.api";
import { DepartmentApprovalStepCoordinatorApi } from "@/modules/attendance/api/department-approval-step-coordinator.api";
import { GroupApprovalStepCoordinatorApi } from "@/modules/attendance/api/group-approval-step-coordinator.api";
import { GroupApi } from "@/modules/attendance/api/group.api";
import { JobTitleApi } from "@/modules/attendance/api/job-title.api";
import { EmployeeApi } from "@/modules/attendance/api/employee.api";
import type { DepartmentApprovalStepDto } from "@/modules/attendance/types/department-approval-step.dto";
import type { GroupApprovalStepDto } from "@/modules/attendance/types/group-approval-step.dto";
import type { ProductionApprovalStepDto } from "@/modules/attendance/types/production-approval-step.dto";
import type { DepartmentApprovalStepCoordinatorDto } from "@/modules/attendance/types/department-approval-step-coordinator.dto";
import type { GroupApprovalStepCoordinatorDto } from "@/modules/attendance/types/group-approval-step-coordinator.dto";
import type { DepartmentDto } from "@/modules/attendance/types/department.dto";
import type { GroupDto } from "@/modules/attendance/types/group.dto";
import type { JobTitleDto } from "@/modules/attendance/types/job-title.dto";
import type { EmployeeDto } from "@/modules/attendance/types/employee.dto";
import { useAuth } from "@/modules/auth/context/AuthContext";
import { hasPermission } from "@/modules/auth/lib/permissions";
import { getApiErrorMessage } from "@/lib/apiError";
import type { ListHandle, ListToolbarProps } from "../list-toolbar";
import { SearchableSelect, type SelectOption } from "@/components/ui/SearchableSelect";
import { useDragReorder } from "./useDragReorder";

const fieldLabelClassName = "mb-1.5 block text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]";
const sectionTitleClassName = "text-sm font-bold uppercase tracking-[0.1em] text-[#191c1e]";

// Tab "Cây duyệt" (2026-08-10) — hợp nhất 2 tab trước đó ("Cây duyệt Bộ phận" + "Cây duyệt Nhóm")
// vào cùng 1 màn cho dễ cấu hình liền mạch: chọn 1 Bộ phận, rồi cấu hình lần lượt (1) cấp trung
// gian theo từng Nhóm con (Staff/Group Leader/Team Leader) và (2) cấp cuối của chính Bộ phận đó
// (Manager/Factory Manager/Director) — đúng thứ tự đơn sẽ đi qua thật (xem
// JobTitleApprovalChainService.ResolveChainCoreAsync: Nhóm trước, Bộ phận sau). Tab "Thử chuỗi
// duyệt" (ApprovalChainPreviewPanel) đã bị bỏ hẳn khỏi màn Danh mục — endpoint BE
// GET /api/JobTitle/resolve-chain vẫn còn, chỉ không còn UI xem trước ở FE.
// Không phải màn CRUD chuẩn nên implement ListHandle tối giản (openCreate no-op).
const ApprovalStepManager = forwardRef<ListHandle, ListToolbarProps>(function ApprovalStepManager(
    { onLoadingChange },
    ref
) {
    const tDept = useTranslations("Attendance.DepartmentApprovalStep");
    const tGroup = useTranslations("Attendance.GroupApprovalStep");
    const tProd = useTranslations("Attendance.ProductionApprovalStep");
    const { user } = useAuth();
    // Chỉ Admin (hoặc người được cấp riêng — không xảy ra trong thực tế) mới quản lý ĐƯỢC danh sách
    // Người phụ trách — bản thân 1 Người phụ trách khi mở màn này (được cho vào từ 2026-08-11 qua
    // sidebar, xem OtManagerSidebar.tsx) không có 2 permission *Coordinator.View nên PHẢI ẩn hẳn khối
    // này đi, nếu không sẽ gọi API và bị 403.
    const canManageDeptCoordinators = hasPermission(user, "Attendance.DepartmentApprovalStepCoordinator.View");
    const canManageGroupCoordinators = hasPermission(user, "Attendance.GroupApprovalStepCoordinator.View");

    const [departments, setDepartments] = useState<DepartmentDto[]>([]);
    const [groups, setGroups] = useState<GroupDto[]>([]);
    const [deptJobTitles, setDeptJobTitles] = useState<JobTitleDto[]>([]);
    const [groupJobTitles, setGroupJobTitles] = useState<JobTitleDto[]>([]);
    // Cây duyệt Chuyền nhận CẢ 2 loại Chức vụ (trung gian lẫn cấp cuối) trong 1 danh sách duy nhất —
    // không lọc theo terminalLevel như 2 khối trên (xem ProductionApprovalStepService.ReplaceAsync).
    const [allJobTitles, setAllJobTitles] = useState<JobTitleDto[]>([]);
    const [departmentId, setDepartmentId] = useState<number | "">("");
    const [isLoadingOptions, setIsLoadingOptions] = useState(true);
    // 2 tab (2026-08-25): "Theo Nhóm" = 2 khối cũ (Nhóm + Bộ phận, dùng cho đơn OT thường) gộp
    // chung 1 tab vì đơn đi xuyên qua CẢ 2 liền mạch (Nhóm trước, Bộ phận sau); "Theo chuyền" = khối
    // Chuyền (1 danh sách duy nhất, dùng cho đơn OT "theo chuyền" Chế tạo) tách tab riêng vì đây là
    // 1 luồng độc lập, không liên quan gì tới cấu hình Nhóm/Bộ phận — khớp đúng 2 chế độ tạo đơn ở
    // CreateOtFormPage.tsx (formMode "group"/"production").
    const [activeTab, setActiveTab] = useState<"group" | "production">("group");

    // ── Khối Chuyền (Bộ phận, 1 danh sách duy nhất — 2026-08-24) ─────────────
    const [productionSteps, setProductionSteps] = useState<ProductionApprovalStepDto[]>([]);
    const [addingProductionJobTitleId, setAddingProductionJobTitleId] = useState<number | "">("");
    const [isLoadingProductionSteps, setIsLoadingProductionSteps] = useState(false);
    const [isSavingProduction, setIsSavingProduction] = useState(false);
    const [isProductionDirty, setIsProductionDirty] = useState(false);

    // ── Khối cấp cuối (Bộ phận) ─────────────────────────────────────────────
    const [deptSteps, setDeptSteps] = useState<DepartmentApprovalStepDto[]>([]);
    const [addingDeptJobTitleId, setAddingDeptJobTitleId] = useState<number | "">("");
    const [isLoadingDeptSteps, setIsLoadingDeptSteps] = useState(false);
    const [isSavingDept, setIsSavingDept] = useState(false);
    const [isDeptDirty, setIsDeptDirty] = useState(false);
    const [deptEmployees, setDeptEmployees] = useState<EmployeeDto[]>([]);
    const [isLoadingDeptEmployees, setIsLoadingDeptEmployees] = useState(false);
    const [assigningDeptEmployeeId, setAssigningDeptEmployeeId] = useState<number | null>(null);
    const [addingDeptHolderByJobTitle, setAddingDeptHolderByJobTitle] = useState<Record<number, number | "">>({});
    const [deptCoordinators, setDeptCoordinators] = useState<DepartmentApprovalStepCoordinatorDto[]>([]);
    const [isLoadingDeptCoordinators, setIsLoadingDeptCoordinators] = useState(false);
    const [isSavingDeptCoordinators, setIsSavingDeptCoordinators] = useState(false);
    const [addingDeptCoordinatorEmployeeId, setAddingDeptCoordinatorEmployeeId] = useState<number | "">("");

    // ── Khối cấp trung gian (Nhóm) ───────────────────────────────────────────
    const [groupId, setGroupId] = useState<number | "">("");
    const [groupSteps, setGroupSteps] = useState<GroupApprovalStepDto[]>([]);
    const [addingGroupJobTitleId, setAddingGroupJobTitleId] = useState<number | "">("");
    const [isLoadingGroupSteps, setIsLoadingGroupSteps] = useState(false);
    const [isSavingGroup, setIsSavingGroup] = useState(false);
    const [isGroupDirty, setIsGroupDirty] = useState(false);
    const [groupEmployees, setGroupEmployees] = useState<EmployeeDto[]>([]);
    const [isLoadingGroupEmployees, setIsLoadingGroupEmployees] = useState(false);
    const [assigningGroupEmployeeId, setAssigningGroupEmployeeId] = useState<number | null>(null);
    const [addingGroupHolderByJobTitle, setAddingGroupHolderByJobTitle] = useState<Record<number, number | "">>({});
    const [groupCoordinators, setGroupCoordinators] = useState<GroupApprovalStepCoordinatorDto[]>([]);
    const [isLoadingGroupCoordinators, setIsLoadingGroupCoordinators] = useState(false);
    const [isSavingGroupCoordinators, setIsSavingGroupCoordinators] = useState(false);
    const [addingGroupCoordinatorEmployeeId, setAddingGroupCoordinatorEmployeeId] = useState<number | "">("");

    useEffect(() => {
        setIsLoadingOptions(true);
        // getMyDepartments (không phải DepartmentApi.getAllDepartments()) — Admin thấy toàn bộ, người
        // được gán phụ trách (Coordinator, không phải Admin) chỉ thấy đúng Bộ phận mình quản, tránh
        // chọn nhầm Bộ phận không thuộc quyền rồi bị 403 khi gọi các API bên dưới (2026-08-25).
        Promise.all([DepartmentApprovalStepApi.getMyDepartments(), GroupApi.getAllGroups(), JobTitleApi.getAllJobTitles()])
            .then(([departmentData, groupData, jobTitleData]) => {
                setDepartments(departmentData);
                setGroups(groupData);
                // Cấp cuối (Manager/Factory Manager/Director) cho khối Bộ phận; cấp trung gian
                // (Staff/Group Leader/Team Leader) cho khối Nhóm.
                setDeptJobTitles(jobTitleData.filter((jt) => jt.terminalLevel !== 0));
                setGroupJobTitles(jobTitleData.filter((jt) => jt.terminalLevel === 0));
                setAllJobTitles(jobTitleData);
            })
            .catch((err) => {
                console.error(err);
                toast.error(tDept("loadOptionsError"));
            })
            .finally(() => setIsLoadingOptions(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        onLoadingChange?.(isLoadingOptions);
    }, [isLoadingOptions, onLoadingChange]);

    const fetchDeptSteps = (targetDepartmentId: number) => {
        setIsLoadingDeptSteps(true);
        DepartmentApprovalStepApi.getByDepartment(targetDepartmentId)
            .then((data) => {
                setDeptSteps(data);
                setIsDeptDirty(false);
            })
            .catch((err) => {
                console.error(err);
                toast.error(getApiErrorMessage(err, tDept("loadStepsError")));
            })
            .finally(() => setIsLoadingDeptSteps(false));
    };

    const fetchProductionSteps = (targetDepartmentId: number) => {
        setIsLoadingProductionSteps(true);
        ProductionApprovalStepApi.getByDepartment(targetDepartmentId)
            .then((data) => {
                setProductionSteps(data);
                setIsProductionDirty(false);
            })
            .catch((err) => {
                console.error(err);
                toast.error(getApiErrorMessage(err, tProd("loadStepsError")));
            })
            .finally(() => setIsLoadingProductionSteps(false));
    };

    const fetchDeptEmployees = (targetDepartmentId: number) => {
        setIsLoadingDeptEmployees(true);
        EmployeeApi.getEmployeesByDepartment(targetDepartmentId)
            .then((data) => setDeptEmployees(data))
            .catch((err) => {
                console.error(err);
                toast.error(getApiErrorMessage(err, tDept("loadEmployeesError")));
            })
            .finally(() => setIsLoadingDeptEmployees(false));
    };

    const fetchDeptCoordinators = (targetDepartmentId: number) => {
        if (!canManageDeptCoordinators) return;
        setIsLoadingDeptCoordinators(true);
        DepartmentApprovalStepCoordinatorApi.getByDepartment(targetDepartmentId)
            .then((data) => setDeptCoordinators(data))
            .catch((err) => {
                console.error(err);
                toast.error(getApiErrorMessage(err, tDept("loadCoordinatorsError")));
            })
            .finally(() => setIsLoadingDeptCoordinators(false));
    };

    const fetchGroupSteps = (targetGroupId: number) => {
        setIsLoadingGroupSteps(true);
        GroupApprovalStepApi.getByGroup(targetGroupId)
            .then((data) => {
                setGroupSteps(data);
                setIsGroupDirty(false);
            })
            .catch((err) => {
                console.error(err);
                toast.error(getApiErrorMessage(err, tGroup("loadStepsError")));
            })
            .finally(() => setIsLoadingGroupSteps(false));
    };

    const fetchGroupEmployees = (targetGroupId: number) => {
        setIsLoadingGroupEmployees(true);
        EmployeeApi.getEmployeesByGroup(targetGroupId)
            .then((data) => setGroupEmployees(data))
            .catch((err) => {
                console.error(err);
                toast.error(getApiErrorMessage(err, tGroup("loadEmployeesError")));
            })
            .finally(() => setIsLoadingGroupEmployees(false));
    };

    const fetchGroupCoordinators = (targetGroupId: number) => {
        if (!canManageGroupCoordinators) return;
        setIsLoadingGroupCoordinators(true);
        GroupApprovalStepCoordinatorApi.getByGroup(targetGroupId)
            .then((data) => setGroupCoordinators(data))
            .catch((err) => {
                console.error(err);
                toast.error(getApiErrorMessage(err, tGroup("loadCoordinatorsError")));
            })
            .finally(() => setIsLoadingGroupCoordinators(false));
    };

    useImperativeHandle(ref, () => ({
        refresh: () => {
            if (typeof departmentId === "number") {
                fetchDeptSteps(departmentId);
                fetchDeptEmployees(departmentId);
                fetchDeptCoordinators(departmentId);
                fetchProductionSteps(departmentId);
            }
            if (typeof groupId === "number") {
                fetchGroupSteps(groupId);
                fetchGroupEmployees(groupId);
                fetchGroupCoordinators(groupId);
            }
        },
        openCreate: () => {},
    }));

    const handleSelectDepartment = (value: number | "") => {
        setDepartmentId(value);
        setDeptSteps([]);
        setDeptEmployees([]);
        setDeptCoordinators([]);
        setAddingDeptJobTitleId("");
        setIsDeptDirty(false);
        setProductionSteps([]);
        setAddingProductionJobTitleId("");
        setIsProductionDirty(false);
        // Đổi Bộ phận thì Nhóm đang chọn (nếu có) không còn thuộc Bộ phận này nữa — reset luôn.
        setGroupId("");
        setGroupSteps([]);
        setGroupEmployees([]);
        setGroupCoordinators([]);
        setAddingGroupJobTitleId("");
        setIsGroupDirty(false);
        if (typeof value === "number") {
            fetchDeptSteps(value);
            fetchDeptEmployees(value);
            fetchDeptCoordinators(value);
            fetchProductionSteps(value);
        }
    };

    const handleSelectGroup = (value: number | "") => {
        setGroupId(value);
        setGroupSteps([]);
        setGroupEmployees([]);
        setGroupCoordinators([]);
        setAddingGroupJobTitleId("");
        setIsGroupDirty(false);
        if (typeof value === "number") {
            fetchGroupSteps(value);
            fetchGroupEmployees(value);
            fetchGroupCoordinators(value);
        }
    };

    // Gán nhanh Chức vụ CẤP CUỐI ngay tại khối Bộ phận — dùng endpoint riêng
    // `PUT /api/Employee/{id}/department-job-title` (2026-08-11c, KHÔNG còn dùng
    // `EmployeeApi.updateEmployee` nữa) để Người phụ trách Cây duyệt (không chỉ Admin) cũng gán được,
    // chỉ trong phạm vi Bộ phận họ phụ trách — BE tự tính lại groupId/departmentId theo TerminalLevel
    // của Chức vụ mới và tự chặn sai phạm vi, FE chỉ gửi jobTitleId. Vẫn giữ pre-check
    // "assignNeedsGroupError" ở FE để tránh 1 vòng gọi API cho lỗi đã biết trước.
    const handleAssignDeptJobTitle = async (employee: EmployeeDto, jobTitleId: number | "") => {
        if (typeof departmentId !== "number") return;
        const nextJobTitleId = jobTitleId === "" ? null : jobTitleId;
        const nextJobTitle = deptJobTitles.find((jt) => jt.id === nextJobTitleId);
        const nextTerminalLevel = nextJobTitle?.terminalLevel ?? 0;

        if (nextTerminalLevel === 0 && employee.groupId === null) {
            // Đang là Trưởng phòng/Trưởng Xưởng/Giám đốc (không có Nhóm thật), muốn bỏ hẳn Chức vụ cấp
            // cuối — màn này không đủ thông tin để tự chọn đúng Nhóm, phải nhờ Admin sửa qua form Nhân viên.
            toast.error(tDept("assignNeedsGroupError"));
            return;
        }

        setAssigningDeptEmployeeId(employee.id);
        try {
            const updated = await EmployeeApi.assignDepartmentJobTitle(employee.id, departmentId, nextJobTitleId);
            setDeptEmployees((current) => current.map((e) => (e.id === employee.id ? updated : e)));
            toast.success(tDept("assignSuccess"));
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, tDept("assignError")));
        } finally {
            setAssigningDeptEmployeeId(null);
        }
    };

    // Gán nhanh Chức vụ TRUNG GIAN ngay tại khối Nhóm — `PUT /api/Employee/{id}/group-job-title`
    // (2026-08-11c). Chức vụ ở đây luôn TerminalLevel=None nên BE giữ nguyên groupId/departmentId,
    // chỉ đổi jobTitleId.
    const handleAssignGroupJobTitle = async (employee: EmployeeDto, jobTitleId: number | "") => {
        if (typeof groupId !== "number") return;
        const nextJobTitleId = jobTitleId === "" ? null : jobTitleId;

        setAssigningGroupEmployeeId(employee.id);
        try {
            const updated = await EmployeeApi.assignGroupJobTitle(employee.id, groupId, nextJobTitleId);
            setGroupEmployees((current) => current.map((e) => (e.id === employee.id ? updated : e)));
            toast.success(tGroup("assignSuccess"));
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, tGroup("assignError")));
        } finally {
            setAssigningGroupEmployeeId(null);
        }
    };

    const handlePickDeptHolder = async (jobTitleId: number, employeeId: number | "") => {
        setAddingDeptHolderByJobTitle((current) => ({ ...current, [jobTitleId]: employeeId }));
        if (employeeId === "") return;
        const employee = deptEmployees.find((e) => e.id === employeeId);
        if (!employee) return;
        await handleAssignDeptJobTitle(employee, jobTitleId);
        setAddingDeptHolderByJobTitle((current) => ({ ...current, [jobTitleId]: "" }));
    };

    const handlePickGroupHolder = async (jobTitleId: number, employeeId: number | "") => {
        setAddingGroupHolderByJobTitle((current) => ({ ...current, [jobTitleId]: employeeId }));
        if (employeeId === "") return;
        const employee = groupEmployees.find((e) => e.id === employeeId);
        if (!employee) return;
        await handleAssignGroupJobTitle(employee, jobTitleId);
        setAddingGroupHolderByJobTitle((current) => ({ ...current, [jobTitleId]: "" }));
    };

    // ── Người phụ trách Cây duyệt — gán tay, KHÔNG suy luận theo Chức vụ (2026-08-11, sửa 2026-08-11b:
    // CHỈ chọn được trong số nhân viên đang thuộc ĐÚNG Bộ phận/Nhóm đang xem — xem
    // docs/docs-be/attendance-module.md §Cây chức vụ, mục "Người phụ trách Cây duyệt"). Tái dùng
    // deptEmployees/groupEmployees (đã tải sẵn cho khối "holdersLabel" ở dưới) làm nguồn cho picker —
    // không gọi thêm API nào khác. Employee CHƯA liên kết tài khoản đăng nhập (userName=null) vẫn
    // chọn được — quyền tương ứng chỉ có hiệu lực sau khi Admin liên kết tài khoản cho họ (tự động,
    // xem EmployeeService.SyncAutoGrantedPermissionsCoreAsync ở BE).
    const handleAddDeptCoordinator = async (employeeId: number | "") => {
        setAddingDeptCoordinatorEmployeeId(employeeId);
        if (employeeId === "" || typeof departmentId !== "number") return;
        const employee = deptEmployees.find((e) => e.id === employeeId);
        if (!employee || deptCoordinators.some((c) => c.employeeId === employee.id)) {
            setAddingDeptCoordinatorEmployeeId("");
            return;
        }
        setIsSavingDeptCoordinators(true);
        try {
            const nextEmployeeIds = [...deptCoordinators.map((c) => c.employeeId), employee.id];
            const data = await DepartmentApprovalStepCoordinatorApi.replaceByDepartment(departmentId, { employeeIds: nextEmployeeIds });
            setDeptCoordinators(data);
            toast.success(tDept("saveCoordinatorSuccess"));
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, tDept("saveCoordinatorError")));
        } finally {
            setIsSavingDeptCoordinators(false);
            setAddingDeptCoordinatorEmployeeId("");
        }
    };

    const handleRemoveDeptCoordinator = async (employeeId: number) => {
        if (typeof departmentId !== "number") return;
        setIsSavingDeptCoordinators(true);
        try {
            const nextEmployeeIds = deptCoordinators.filter((c) => c.employeeId !== employeeId).map((c) => c.employeeId);
            const data = await DepartmentApprovalStepCoordinatorApi.replaceByDepartment(departmentId, { employeeIds: nextEmployeeIds });
            setDeptCoordinators(data);
            toast.success(tDept("saveCoordinatorSuccess"));
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, tDept("saveCoordinatorError")));
        } finally {
            setIsSavingDeptCoordinators(false);
        }
    };

    const handleAddGroupCoordinator = async (employeeId: number | "") => {
        setAddingGroupCoordinatorEmployeeId(employeeId);
        if (employeeId === "" || typeof groupId !== "number") return;
        const employee = groupEmployees.find((e) => e.id === employeeId);
        if (!employee || groupCoordinators.some((c) => c.employeeId === employee.id)) {
            setAddingGroupCoordinatorEmployeeId("");
            return;
        }
        setIsSavingGroupCoordinators(true);
        try {
            const nextEmployeeIds = [...groupCoordinators.map((c) => c.employeeId), employee.id];
            const data = await GroupApprovalStepCoordinatorApi.replaceByGroup(groupId, { employeeIds: nextEmployeeIds });
            setGroupCoordinators(data);
            toast.success(tGroup("saveCoordinatorSuccess"));
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, tGroup("saveCoordinatorError")));
        } finally {
            setIsSavingGroupCoordinators(false);
            setAddingGroupCoordinatorEmployeeId("");
        }
    };

    const handleRemoveGroupCoordinator = async (employeeId: number) => {
        if (typeof groupId !== "number") return;
        setIsSavingGroupCoordinators(true);
        try {
            const nextEmployeeIds = groupCoordinators.filter((c) => c.employeeId !== employeeId).map((c) => c.employeeId);
            const data = await GroupApprovalStepCoordinatorApi.replaceByGroup(groupId, { employeeIds: nextEmployeeIds });
            setGroupCoordinators(data);
            toast.success(tGroup("saveCoordinatorSuccess"));
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, tGroup("saveCoordinatorError")));
        } finally {
            setIsSavingGroupCoordinators(false);
        }
    };

    // Options cho picker "Người phụ trách" — nguồn từ pool nhân viên (đã lọc theo đúng Bộ phận/Nhóm ở
    // BE khi tải), bớt người đã có mặt trong danh sách phụ trách hiện tại. Đánh dấu rõ nhân viên CHƯA
    // liên kết tài khoản đăng nhập để Admin biết quyền sẽ chưa có hiệu lực ngay.
    const buildCoordinatorOptions = (pool: EmployeeDto[], excludeEmployeeIds: Set<number>): SelectOption[] =>
        pool
            .filter((e) => !excludeEmployeeIds.has(e.id))
            .map((e) => ({
                value: e.id,
                label: `${e.lastName} ${e.firstName} (${e.code})${e.userName ? "" : ` — ${tDept("coordinatorNotLinked")}`}`,
                searchText: [e.lastName, e.firstName, `${e.firstName} ${e.lastName}`, e.code].join(" ").toLowerCase(),
            }));

    const buildHolderOptions = (pool: EmployeeDto[], jobTitleId: number): SelectOption[] =>
        pool
            .filter((e) => e.jobTitleId !== jobTitleId)
            .map((e) => ({
                value: e.id,
                label: `${e.lastName} ${e.firstName} (${e.code})${e.jobTitleName ? ` — ${e.jobTitleName}` : ""}`,
                searchText: [e.lastName, e.firstName, `${e.firstName} ${e.lastName}`, e.code, e.jobTitleName ?? ""]
                    .join(" ")
                    .toLowerCase(),
            }));

    // ── Options cho 2 combobox cấp trên: Bộ phận (toàn công ty) + Nhóm (lọc theo Bộ phận đã chọn) —
    // cả 2 đều dùng SearchableSelect vì số lượng Bộ phận/Nhóm thực tế có thể khá nhiều, cuộn <select>
    // thường sẽ khó dùng hơn gõ tìm (quy tắc chung — xem docs/docs-fe/DESIGN_SYSTEM.md §4.3).
    const departmentOptions: SelectOption[] = departments.map((d) => ({
        value: d.id,
        label: d.departmentNameVn,
        searchText: `${d.departmentNameVn} ${d.departmentCode}`.toLowerCase(),
    }));
    const groupOptions: SelectOption[] = groups
        .filter((g) => g.departmentId === departmentId)
        .map((g) => ({
            value: g.id,
            label: g.groupNameVn,
            searchText: `${g.groupNameVn} ${g.groupCode}`.toLowerCase(),
        }));

    // ── Khối Bộ phận: thêm/xoá/sắp xếp/lưu bước ──────────────────────────────
    const usedDeptJobTitleIds = new Set(deptSteps.map((s) => s.jobTitleId));
    const availableDeptJobTitles = deptJobTitles.filter((jt) => !usedDeptJobTitleIds.has(jt.id));

    const handleAddDeptStep = () => {
        if (!addingDeptJobTitleId) return;
        const jobTitle = deptJobTitles.find((jt) => jt.id === addingDeptJobTitleId);
        if (!jobTitle) return;
        setDeptSteps((current) => [
            ...current,
            {
                id: 0,
                departmentId: typeof departmentId === "number" ? departmentId : 0,
                stepOrder: current.length + 1,
                jobTitleId: jobTitle.id,
                jobTitleCode: jobTitle.code,
                jobTitleName: jobTitle.name,
                rankOrder: jobTitle.rankOrder,
                requiresSignature: false,
                terminalLevel: jobTitle.terminalLevel,
            },
        ]);
        setAddingDeptJobTitleId("");
        setIsDeptDirty(true);
    };

    const handleRemoveDeptStep = (index: number) => {
        setDeptSteps((current) => current.filter((_, i) => i !== index));
        setIsDeptDirty(true);
    };

    const handleToggleDeptSignature = (index: number) => {
        setDeptSteps((current) =>
            current.map((step, i) => (i === index ? { ...step, requiresSignature: !step.requiresSignature } : step))
        );
        setIsDeptDirty(true);
    };

    const handleReorderDeptSteps = (next: DepartmentApprovalStepDto[]) => {
        setDeptSteps(next);
        setIsDeptDirty(true);
    };
    const deptDrag = useDragReorder(deptSteps, handleReorderDeptSteps, (s) => s.jobTitleId);

    const handleSaveDept = async () => {
        if (typeof departmentId !== "number") return;
        setIsSavingDept(true);
        try {
            const data = await DepartmentApprovalStepApi.replaceByDepartment(
                departmentId,
                deptSteps.map((s) => ({ jobTitleId: s.jobTitleId, requiresSignature: s.requiresSignature }))
            );
            setDeptSteps(data);
            setIsDeptDirty(false);
            toast.success(tDept("saveSuccess"));
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, tDept("saveError")));
        } finally {
            setIsSavingDept(false);
        }
    };

    // ── Khối Chuyền: thêm/xoá/sắp xếp/lưu bước ────────────────────────────────
    const usedProductionJobTitleIds = new Set(productionSteps.map((s) => s.jobTitleId));
    const availableProductionJobTitles = allJobTitles.filter((jt) => !usedProductionJobTitleIds.has(jt.id));

    // Đúng 2 ô "Người đề nghị" cố định trên giấy in — CHỈ tính cấp trung gian (terminalLevel===0:
    // Line Leader/Group Leader/Team Leader), 3 cấp cuối có 3 ô chữ ký riêng, không tính vào đây —
    // mirror groupSigningCount nhưng lọc thêm theo terminalLevel (xem ProductionApprovalStepService.ReplaceAsync).
    const productionIntermediateSteps = productionSteps.filter((s) => s.terminalLevel === 0);
    const productionSigningCount = productionIntermediateSteps.filter((s) => s.requiresSignature).length;
    const productionSigningLimitReached = productionSigningCount >= 2;
    const productionSigningMinNotMet = productionIntermediateSteps.length > 0 && productionSigningCount === 0;

    const handleAddProductionStep = () => {
        if (!addingProductionJobTitleId) return;
        const jobTitle = allJobTitles.find((jt) => jt.id === addingProductionJobTitleId);
        if (!jobTitle) return;
        setProductionSteps((current) => [
            ...current,
            {
                id: 0,
                departmentId: typeof departmentId === "number" ? departmentId : 0,
                stepOrder: current.length + 1,
                jobTitleId: jobTitle.id,
                jobTitleCode: jobTitle.code,
                jobTitleName: jobTitle.name,
                rankOrder: jobTitle.rankOrder,
                requiresSignature: false,
                isResponsible: false,
                terminalLevel: jobTitle.terminalLevel,
            },
        ]);
        setAddingProductionJobTitleId("");
        setIsProductionDirty(true);
    };

    const handleRemoveProductionStep = (index: number) => {
        setProductionSteps((current) => current.filter((_, i) => i !== index));
        setIsProductionDirty(true);
    };

    const handleToggleProductionSignature = (index: number) => {
        const target = productionSteps[index];
        if (target.terminalLevel === 0 && !target.requiresSignature && productionSigningLimitReached) {
            toast.error(tProd("signingLimitToggleError"));
            return;
        }
        setProductionSteps((current) =>
            current.map((step, i) => (i === index ? { ...step, requiresSignature: !step.requiresSignature } : step))
        );
        setIsProductionDirty(true);
    };

    const handleSetProductionResponsible = (index: number) => {
        setProductionSteps((current) =>
            current.map((step, i) => ({ ...step, isResponsible: i === index ? !current[index].isResponsible : false }))
        );
        setIsProductionDirty(true);
    };

    const handleReorderProductionSteps = (next: ProductionApprovalStepDto[]) => {
        setProductionSteps(next);
        setIsProductionDirty(true);
    };
    const productionDrag = useDragReorder(productionSteps, handleReorderProductionSteps, (s) => s.jobTitleId);

    const handleSaveProduction = async () => {
        if (typeof departmentId !== "number") return;
        setIsSavingProduction(true);
        try {
            const data = await ProductionApprovalStepApi.replaceByDepartment(
                departmentId,
                productionSteps.map((s) => ({ jobTitleId: s.jobTitleId, requiresSignature: s.requiresSignature, isResponsible: s.isResponsible }))
            );
            setProductionSteps(data);
            setIsProductionDirty(false);
            toast.success(tProd("saveSuccess"));
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, tProd("saveError")));
        } finally {
            setIsSavingProduction(false);
        }
    };

    // ── Khối Nhóm: thêm/xoá/sắp xếp/lưu bước ─────────────────────────────────
    const usedGroupJobTitleIds = new Set(groupSteps.map((s) => s.jobTitleId));
    const availableGroupJobTitles = groupJobTitles.filter((jt) => !usedGroupJobTitleIds.has(jt.id));

    // Đúng 2 ô "Người đề nghị" cố định trên giấy in YEV-22-024 — xem GroupApprovalStepService.ReplaceAsync.
    const groupSigningCount = groupSteps.filter((s) => s.requiresSignature).length;
    const groupSigningLimitReached = groupSigningCount >= 2;
    const groupSigningMinNotMet = groupSteps.length > 0 && groupSigningCount === 0;

    const handleAddGroupStep = () => {
        if (!addingGroupJobTitleId) return;
        const jobTitle = groupJobTitles.find((jt) => jt.id === addingGroupJobTitleId);
        if (!jobTitle) return;
        setGroupSteps((current) => [
            ...current,
            {
                id: 0,
                groupId: typeof groupId === "number" ? groupId : 0,
                stepOrder: current.length + 1,
                jobTitleId: jobTitle.id,
                jobTitleCode: jobTitle.code,
                jobTitleName: jobTitle.name,
                rankOrder: jobTitle.rankOrder,
                requiresSignature: false,
                isResponsible: false,
                terminalLevel: jobTitle.terminalLevel,
            },
        ]);
        setAddingGroupJobTitleId("");
        setIsGroupDirty(true);
    };

    const handleRemoveGroupStep = (index: number) => {
        setGroupSteps((current) => current.filter((_, i) => i !== index));
        setIsGroupDirty(true);
    };

    const handleToggleGroupSignature = (index: number) => {
        const target = groupSteps[index];
        if (!target.requiresSignature && groupSigningLimitReached) {
            toast.error(tGroup("signingLimitToggleError"));
            return;
        }
        setGroupSteps((current) =>
            current.map((step, i) => (i === index ? { ...step, requiresSignature: !step.requiresSignature } : step))
        );
        setIsGroupDirty(true);
    };

    const handleSetGroupResponsible = (index: number) => {
        setGroupSteps((current) =>
            current.map((step, i) => ({ ...step, isResponsible: i === index ? !current[index].isResponsible : false }))
        );
        setIsGroupDirty(true);
    };

    const handleReorderGroupSteps = (next: GroupApprovalStepDto[]) => {
        setGroupSteps(next);
        setIsGroupDirty(true);
    };
    const groupDrag = useDragReorder(groupSteps, handleReorderGroupSteps, (s) => s.jobTitleId);

    const handleSaveGroup = async () => {
        if (typeof groupId !== "number") return;
        setIsSavingGroup(true);
        try {
            const data = await GroupApprovalStepApi.replaceByGroup(
                groupId,
                groupSteps.map((s) => ({ jobTitleId: s.jobTitleId, requiresSignature: s.requiresSignature, isResponsible: s.isResponsible }))
            );
            setGroupSteps(data);
            setIsGroupDirty(false);
            toast.success(tGroup("saveSuccess"));
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, tGroup("saveError")));
        } finally {
            setIsSavingGroup(false);
        }
    };

    return (
        <div className="space-y-4">
            <section className="space-y-4 rounded-xl border border-[#e0e3e5] bg-white p-6 shadow-sm">
                <p className="text-sm text-[#5e3f3a]">{tDept("intro")}</p>

                <label className="block max-w-sm">
                    <span className={fieldLabelClassName}>{tDept("fieldDepartment")}</span>
                    <SearchableSelect
                        options={departmentOptions}
                        value={departmentId}
                        onChange={handleSelectDepartment}
                        placeholder={tDept("fieldDepartmentPlaceholder")}
                        disabled={isLoadingOptions}
                    />
                </label>
            </section>

            {typeof departmentId === "number" && (
                <>
                    <div className="flex flex-wrap gap-1 border-b border-[#e0e3e5]">
                        {(["group", "production"] as const).map((tab) => (
                            <button
                                key={tab}
                                type="button"
                                onClick={() => setActiveTab(tab)}
                                className={`cursor-pointer border-b-2 px-4 py-2.5 text-sm font-semibold transition ${
                                    activeTab === tab
                                        ? "border-[#e3000f] text-[#191c1e]"
                                        : "border-transparent text-[#5e3f3a] hover:text-[#191c1e]"
                                }`}
                            >
                                {tab === "group" ? tDept("tabGroupModeLabel") : tDept("tabProductionModeLabel")}
                            </button>
                        ))}
                    </div>

                    {activeTab === "group" && (
                        <>
                    {/* Khối cấp trung gian — theo Nhóm con của Bộ phận đang chọn (đơn đi qua khối này TRƯỚC) */}
                    <section className="space-y-4 rounded-xl border border-[#e0e3e5] bg-white p-6 shadow-sm">
                        <div className="space-y-1">
                            <h3 className={sectionTitleClassName}>{tGroup("sectionTitle")}</h3>
                            <p className="text-sm text-[#5e3f3a]">{tGroup("description")}</p>
                        </div>

                        <label className="block max-w-sm">
                            <span className={fieldLabelClassName}>{tGroup("fieldGroup")}</span>
                            <SearchableSelect
                                options={groupOptions}
                                value={groupId}
                                onChange={handleSelectGroup}
                                placeholder={tGroup("fieldGroupPlaceholder")}
                                disabled={isLoadingOptions}
                            />
                        </label>

                        {typeof groupId !== "number" && (
                            <p className="text-sm italic text-[#8a8f94]">{tGroup("chooseGroupHint")}</p>
                        )}

                        {typeof groupId === "number" && canManageGroupCoordinators && (
                            <div className="space-y-2 rounded-lg border border-[#e0e3e5] bg-[#f8fafc] p-3">
                                <div className="space-y-0.5">
                                    <span className="block text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">
                                        {tGroup("coordinatorsTitle")}
                                    </span>
                                    <p className="text-xs text-[#8a8f94]">{tGroup("coordinatorsHint")}</p>
                                </div>
                                <div className="flex flex-wrap items-center gap-1.5">
                                    <span className="text-xs font-semibold text-[#8a8f94]">{tGroup("coordinatorsLabel")}</span>
                                    {isLoadingGroupCoordinators ? (
                                        <span className="text-xs text-[#8a8f94]">{tGroup("loadingCoordinators")}</span>
                                    ) : (
                                        <>
                                            {groupCoordinators.length === 0 ? (
                                                <span className="text-xs italic text-[#8a8f94]">{tGroup("noCoordinators")}</span>
                                            ) : (
                                                groupCoordinators.map((coordinator) => (
                                                    <span
                                                        key={coordinator.employeeId}
                                                        className="inline-flex items-center gap-1 rounded-full border border-[#e0e3e5] bg-white py-0.5 pl-2 pr-1 text-xs text-[#5e3f3a]"
                                                    >
                                                        {coordinator.fullName} ({coordinator.employeeCode})
                                                        {!coordinator.userName && (
                                                            <span className="text-[#9a5b00]" title={tGroup("coordinatorNotLinkedHint")}>
                                                                — {tGroup("coordinatorNotLinked")}
                                                            </span>
                                                        )}
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemoveGroupCoordinator(coordinator.employeeId)}
                                                            disabled={isSavingGroupCoordinators}
                                                            title={tGroup("removeCoordinatorHint")}
                                                            aria-label={tGroup("removeCoordinatorHint")}
                                                            className="cursor-pointer rounded-full p-0.5 text-[#8a8f94] transition hover:bg-[#fff4f2] hover:text-[#930006] disabled:cursor-not-allowed disabled:opacity-40"
                                                        >
                                                            <X size={10} />
                                                        </button>
                                                    </span>
                                                ))
                                            )}
                                            <div className="w-56 shrink-0">
                                                <SearchableSelect
                                                    options={buildCoordinatorOptions(
                                                        groupEmployees,
                                                        new Set(groupCoordinators.map((c) => c.employeeId))
                                                    )}
                                                    value={addingGroupCoordinatorEmployeeId}
                                                    onChange={handleAddGroupCoordinator}
                                                    placeholder={tGroup("addCoordinatorPlaceholder")}
                                                    disabled={isSavingGroupCoordinators || isLoadingGroupEmployees}
                                                    triggerClassName="h-7 rounded-full border border-dashed border-[#e0e3e5] bg-white px-2 pr-7 text-xs text-[#5e3f3a] outline-none transition focus:border-[#e3000f]"
                                                />
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        )}

                        {typeof groupId === "number" && (
                            isLoadingGroupSteps ? (
                                <p className="text-sm text-[#5e3f3a]">{tGroup("loadingSteps")}</p>
                            ) : (
                                <>
                                    {groupSteps.length === 0 && <p className="text-sm text-[#5e3f3a]">{tGroup("noSteps")}</p>}

                                    {groupSteps.length > 0 && (
                                        <ol className="space-y-2">
                                            {groupSteps.map((step, index) => (
                                                <li
                                                    key={step.jobTitleId}
                                                    ref={groupDrag.registerNode(step.jobTitleId)}
                                                    draggable
                                                    onDragStart={groupDrag.handleDragStart(index)}
                                                    onDragOver={groupDrag.handleDragOver(index)}
                                                    onDragEnd={groupDrag.handleDragEnd}
                                                    className={`relative space-y-2 rounded-lg border p-3 transition-[box-shadow,border-color,background-color] duration-150 ${
                                                        groupDrag.dragIndex === index
                                                            ? "z-10 scale-[1.01] border-[#e3000f] bg-[#fff4f2] shadow-lg ring-2 ring-[#e3000f]/25"
                                                            : "border-[#e0e3e5] bg-white"
                                                    }`}
                                                >
                                                    <div className="flex flex-wrap items-center gap-2 lg:flex-nowrap">
                                                        <span
                                                            title={tGroup("dragHandleLabel")}
                                                            aria-label={tGroup("dragHandleLabel")}
                                                            className="shrink-0 cursor-grab text-[#8a8f94] active:cursor-grabbing"
                                                        >
                                                            <GripVertical className="h-4 w-4" />
                                                        </span>
                                                        <div className="flex w-[230px] shrink-0 items-center gap-2" title={`${step.jobTitleName} (${step.jobTitleCode}, cấp ${step.rankOrder})`}>
                                                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#191c1e] text-xs font-bold text-white">
                                                                {index + 1}
                                                            </span>
                                                            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[#191c1e]">{step.jobTitleName}</span>
                                                            <span className="shrink-0 whitespace-nowrap text-xs text-[#8a8f94]">({step.jobTitleCode}, cấp {step.rankOrder})</span>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleToggleGroupSignature(index)}
                                                            title={tGroup("toggleSignatureHint")}
                                                            className={`inline-flex min-w-[118px] shrink-0 cursor-pointer items-center justify-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-semibold transition ${
                                                                step.requiresSignature
                                                                    ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                                                    : "border-[#e0e3e5] bg-white text-[#8a8f94] hover:bg-[#f2f4f6]"
                                                            }`}
                                                        >
                                                            {step.requiresSignature ? <Check size={11} /> : <X size={11} />}
                                                            {step.requiresSignature ? tGroup("requiresSignatureYes") : tGroup("requiresSignatureNo")}
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleSetGroupResponsible(index)}
                                                            title={tGroup("toggleResponsibleHint")}
                                                            className={`inline-flex min-w-[118px] shrink-0 cursor-pointer items-center justify-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-semibold transition ${
                                                                step.isResponsible
                                                                    ? "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                                                                    : "border-[#e0e3e5] bg-white text-[#8a8f94] hover:bg-[#f2f4f6]"
                                                            }`}
                                                        >
                                                            <Star size={11} fill={step.isResponsible ? "currentColor" : "none"} />
                                                            {step.isResponsible ? tGroup("isResponsibleYes") : tGroup("isResponsibleNo")}
                                                        </button>
                                                        <div className="ml-auto flex shrink-0 items-center gap-1">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleRemoveGroupStep(index)}
                                                                title={tGroup("removeStep")}
                                                                aria-label={tGroup("removeStep")}
                                                                className="cursor-pointer rounded-lg border border-[#e9bcb6] bg-white p-1.5 text-[#930006] transition hover:bg-[#fff4f2]"
                                                            >
                                                                <Trash2 className="h-3.5 w-3.5" />
                                                            </button>
                                                        </div>
                                                    </div>

                                                    <div className="flex flex-wrap items-center gap-1.5 pl-8">
                                                        <span className="text-xs font-semibold text-[#8a8f94]">{tGroup("holdersLabel")}</span>
                                                        {isLoadingGroupEmployees ? (
                                                            <span className="text-xs text-[#8a8f94]">{tGroup("loadingEmployees")}</span>
                                                        ) : (
                                                            <>
                                                                {(() => {
                                                                    const holders = groupEmployees.filter((e) => e.jobTitleId === step.jobTitleId);
                                                                    return holders.length === 0 ? (
                                                                        <span className="text-xs italic text-[#8a8f94]">{tGroup("noHolders")}</span>
                                                                    ) : (
                                                                        holders.map((holder) => (
                                                                            <span
                                                                                key={holder.id}
                                                                                className="inline-flex items-center gap-1 rounded-full border border-[#e0e3e5] bg-[#f8fafc] py-0.5 pl-2 pr-1 text-xs text-[#5e3f3a]"
                                                                            >
                                                                                {holder.lastName} {holder.firstName} ({holder.code})
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => handleAssignGroupJobTitle(holder, "")}
                                                                                    disabled={assigningGroupEmployeeId === holder.id}
                                                                                    title={tGroup("removeHolderHint")}
                                                                                    aria-label={tGroup("removeHolderHint")}
                                                                                    className="cursor-pointer rounded-full p-0.5 text-[#8a8f94] transition hover:bg-[#fff4f2] hover:text-[#930006] disabled:cursor-not-allowed disabled:opacity-40"
                                                                                >
                                                                                    <X size={10} />
                                                                                </button>
                                                                            </span>
                                                                        ))
                                                                    );
                                                                })()}
                                                                <div className="w-56 shrink-0">
                                                                    <SearchableSelect
                                                                        options={buildHolderOptions(groupEmployees, step.jobTitleId)}
                                                                        value={addingGroupHolderByJobTitle[step.jobTitleId] ?? ""}
                                                                        onChange={(v) => handlePickGroupHolder(step.jobTitleId, v)}
                                                                        placeholder={tGroup("addHolderPlaceholder")}
                                                                        disabled={assigningGroupEmployeeId !== null}
                                                                        triggerClassName="h-7 rounded-full border border-dashed border-[#e0e3e5] bg-white px-2 pr-7 text-xs text-[#5e3f3a] outline-none transition focus:border-[#e3000f]"
                                                                    />
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>
                                                </li>
                                            ))}
                                        </ol>
                                    )}

                                    <div className="flex flex-wrap items-center gap-2 border-t border-[#e0e3e5] pt-4">
                                        <select
                                            value={addingGroupJobTitleId}
                                            onChange={(event) => setAddingGroupJobTitleId(event.target.value ? Number(event.target.value) : "")}
                                            className="h-10 flex-1 min-w-[220px] rounded-lg border border-[#e0e3e5] bg-white px-3 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3]"
                                        >
                                            <option value="">{tGroup("fieldAddJobTitlePlaceholder")}</option>
                                            {availableGroupJobTitles.map((jobTitle) => (
                                                <option key={jobTitle.id} value={jobTitle.id}>
                                                    {jobTitle.name} ({jobTitle.code}, cấp {jobTitle.rankOrder})
                                                </option>
                                            ))}
                                        </select>
                                        <button
                                            type="button"
                                            onClick={handleAddGroupStep}
                                            disabled={!addingGroupJobTitleId}
                                            className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#e0e3e5] bg-white px-3 py-2 text-sm font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6] disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                            <Plus className="h-3.5 w-3.5" /> {tGroup("addStepButton")}
                                        </button>
                                    </div>
                                    {groupSigningMinNotMet && <p className="text-xs text-[#930006]">{tGroup("intermediateMinHint")}</p>}
                                    {groupSigningLimitReached && <p className="text-xs text-[#9a5b00]">{tGroup("intermediateLimitHint")}</p>}

                                    <div className="flex justify-end pt-2">
                                        <button
                                            type="button"
                                            onClick={handleSaveGroup}
                                            disabled={!isGroupDirty || isSavingGroup || groupSigningMinNotMet}
                                            className="cursor-pointer rounded-lg bg-[#e3000f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#b40009] disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                            {isSavingGroup ? tGroup("saving") : tGroup("saveButton")}
                                        </button>
                                    </div>
                                </>
                            )
                        )}
                    </section>

                    {/* Khối cấp cuối — theo chính Bộ phận đang chọn (đơn đi qua khối này SAU khối Nhóm) */}
                    <section className="space-y-4 rounded-xl border border-[#e0e3e5] bg-white p-6 shadow-sm">
                        <div className="space-y-1">
                            <h3 className={sectionTitleClassName}>{tDept("sectionTitle")}</h3>
                            <p className="text-sm text-[#5e3f3a]">{tDept("description")}</p>
                        </div>

                        {canManageDeptCoordinators && (
                        <div className="space-y-2 rounded-lg border border-[#e0e3e5] bg-[#f8fafc] p-3">
                            <div className="space-y-0.5">
                                <span className="block text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">
                                    {tDept("coordinatorsTitle")}
                                </span>
                                <p className="text-xs text-[#8a8f94]">{tDept("coordinatorsHint")}</p>
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5">
                                <span className="text-xs font-semibold text-[#8a8f94]">{tDept("coordinatorsLabel")}</span>
                                {isLoadingDeptCoordinators ? (
                                    <span className="text-xs text-[#8a8f94]">{tDept("loadingCoordinators")}</span>
                                ) : (
                                    <>
                                        {deptCoordinators.length === 0 ? (
                                            <span className="text-xs italic text-[#8a8f94]">{tDept("noCoordinators")}</span>
                                        ) : (
                                            deptCoordinators.map((coordinator) => (
                                                <span
                                                    key={coordinator.employeeId}
                                                    className="inline-flex items-center gap-1 rounded-full border border-[#e0e3e5] bg-white py-0.5 pl-2 pr-1 text-xs text-[#5e3f3a]"
                                                >
                                                    {coordinator.fullName} ({coordinator.employeeCode})
                                                    {!coordinator.userName && (
                                                        <span className="text-[#9a5b00]" title={tDept("coordinatorNotLinkedHint")}>
                                                            — {tDept("coordinatorNotLinked")}
                                                        </span>
                                                    )}
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveDeptCoordinator(coordinator.employeeId)}
                                                        disabled={isSavingDeptCoordinators}
                                                        title={tDept("removeCoordinatorHint")}
                                                        aria-label={tDept("removeCoordinatorHint")}
                                                        className="cursor-pointer rounded-full p-0.5 text-[#8a8f94] transition hover:bg-[#fff4f2] hover:text-[#930006] disabled:cursor-not-allowed disabled:opacity-40"
                                                    >
                                                        <X size={10} />
                                                    </button>
                                                </span>
                                            ))
                                        )}
                                        <div className="w-56 shrink-0">
                                            <SearchableSelect
                                                options={buildCoordinatorOptions(
                                                    deptEmployees,
                                                    new Set(deptCoordinators.map((c) => c.employeeId))
                                                )}
                                                value={addingDeptCoordinatorEmployeeId}
                                                onChange={handleAddDeptCoordinator}
                                                placeholder={tDept("addCoordinatorPlaceholder")}
                                                disabled={isSavingDeptCoordinators || isLoadingDeptEmployees}
                                                triggerClassName="h-7 rounded-full border border-dashed border-[#e0e3e5] bg-white px-2 pr-7 text-xs text-[#5e3f3a] outline-none transition focus:border-[#e3000f]"
                                            />
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                        )}

                        {isLoadingDeptSteps ? (
                            <p className="text-sm text-[#5e3f3a]">{tDept("loadingSteps")}</p>
                        ) : (
                            <>
                                {deptSteps.length === 0 && <p className="text-sm text-[#5e3f3a]">{tDept("noSteps")}</p>}

                                {deptSteps.length > 0 && (
                                    <ol className="space-y-2">
                                        {deptSteps.map((step, index) => (
                                            <li
                                                key={step.jobTitleId}
                                                ref={deptDrag.registerNode(step.jobTitleId)}
                                                draggable
                                                onDragStart={deptDrag.handleDragStart(index)}
                                                onDragOver={deptDrag.handleDragOver(index)}
                                                onDragEnd={deptDrag.handleDragEnd}
                                                className={`relative space-y-2 rounded-lg border p-3 transition-[box-shadow,border-color,background-color] duration-150 ${
                                                    deptDrag.dragIndex === index
                                                        ? "z-10 scale-[1.01] border-[#e3000f] bg-[#fff4f2] shadow-lg ring-2 ring-[#e3000f]/25"
                                                        : "border-[#e0e3e5] bg-white"
                                                }`}
                                            >
                                                <div className="flex flex-wrap items-center gap-2 lg:flex-nowrap">
                                                    <span
                                                        title={tDept("dragHandleLabel")}
                                                        aria-label={tDept("dragHandleLabel")}
                                                        className="shrink-0 cursor-grab text-[#8a8f94] active:cursor-grabbing"
                                                    >
                                                        <GripVertical className="h-4 w-4" />
                                                    </span>
                                                    <div className="flex w-[230px] shrink-0 items-center gap-2" title={`${step.jobTitleName} (${step.jobTitleCode}, cấp ${step.rankOrder})`}>
                                                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#191c1e] text-xs font-bold text-white">
                                                            {index + 1}
                                                        </span>
                                                        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[#191c1e]">{step.jobTitleName}</span>
                                                        <span className="shrink-0 whitespace-nowrap text-xs text-[#8a8f94]">({step.jobTitleCode}, cấp {step.rankOrder})</span>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleToggleDeptSignature(index)}
                                                        title={tDept("toggleSignatureHint")}
                                                        className={`inline-flex min-w-[118px] shrink-0 cursor-pointer items-center justify-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-semibold transition ${
                                                            step.requiresSignature
                                                                ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                                                : "border-[#e0e3e5] bg-white text-[#8a8f94] hover:bg-[#f2f4f6]"
                                                        }`}
                                                    >
                                                        {step.requiresSignature ? <Check size={11} /> : <X size={11} />}
                                                        {step.requiresSignature ? tDept("requiresSignatureYes") : tDept("requiresSignatureNo")}
                                                    </button>
                                                    <div className="ml-auto flex shrink-0 items-center gap-1">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemoveDeptStep(index)}
                                                            title={tDept("removeStep")}
                                                            aria-label={tDept("removeStep")}
                                                            className="cursor-pointer rounded-lg border border-[#e9bcb6] bg-white p-1.5 text-[#930006] transition hover:bg-[#fff4f2]"
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </button>
                                                    </div>
                                                </div>

                                                <div className="flex flex-wrap items-center gap-1.5 pl-8">
                                                    <span className="text-xs font-semibold text-[#8a8f94]">{tDept("holdersLabel")}</span>
                                                    {isLoadingDeptEmployees ? (
                                                        <span className="text-xs text-[#8a8f94]">{tDept("loadingEmployees")}</span>
                                                    ) : (
                                                        <>
                                                            {(() => {
                                                                const holders = deptEmployees.filter((e) => e.jobTitleId === step.jobTitleId);
                                                                return holders.length === 0 ? (
                                                                    <span className="text-xs italic text-[#8a8f94]">{tDept("noHolders")}</span>
                                                                ) : (
                                                                    holders.map((holder) => (
                                                                        <span
                                                                            key={holder.id}
                                                                            className="inline-flex items-center gap-1 rounded-full border border-[#e0e3e5] bg-[#f8fafc] py-0.5 pl-2 pr-1 text-xs text-[#5e3f3a]"
                                                                        >
                                                                            {holder.lastName} {holder.firstName} ({holder.code})
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => handleAssignDeptJobTitle(holder, "")}
                                                                                disabled={assigningDeptEmployeeId === holder.id}
                                                                                title={tDept("removeHolderHint")}
                                                                                aria-label={tDept("removeHolderHint")}
                                                                                className="cursor-pointer rounded-full p-0.5 text-[#8a8f94] transition hover:bg-[#fff4f2] hover:text-[#930006] disabled:cursor-not-allowed disabled:opacity-40"
                                                                            >
                                                                                <X size={10} />
                                                                            </button>
                                                                        </span>
                                                                    ))
                                                                );
                                                            })()}
                                                            <div className="w-56 shrink-0">
                                                                <SearchableSelect
                                                                    options={buildHolderOptions(deptEmployees, step.jobTitleId)}
                                                                    value={addingDeptHolderByJobTitle[step.jobTitleId] ?? ""}
                                                                    onChange={(v) => handlePickDeptHolder(step.jobTitleId, v)}
                                                                    placeholder={tDept("addHolderPlaceholder")}
                                                                    disabled={assigningDeptEmployeeId !== null}
                                                                    triggerClassName="h-7 rounded-full border border-dashed border-[#e0e3e5] bg-white px-2 pr-7 text-xs text-[#5e3f3a] outline-none transition focus:border-[#e3000f]"
                                                                />
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            </li>
                                        ))}
                                    </ol>
                                )}

                                <div className="flex flex-wrap items-center gap-2 border-t border-[#e0e3e5] pt-4">
                                    <select
                                        value={addingDeptJobTitleId}
                                        onChange={(event) => setAddingDeptJobTitleId(event.target.value ? Number(event.target.value) : "")}
                                        className="h-10 flex-1 min-w-[220px] rounded-lg border border-[#e0e3e5] bg-white px-3 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3]"
                                    >
                                        <option value="">{tDept("fieldAddJobTitlePlaceholder")}</option>
                                        {availableDeptJobTitles.map((jobTitle) => (
                                            <option key={jobTitle.id} value={jobTitle.id}>
                                                {jobTitle.name} ({jobTitle.code}, cấp {jobTitle.rankOrder})
                                            </option>
                                        ))}
                                    </select>
                                    <button
                                        type="button"
                                        onClick={handleAddDeptStep}
                                        disabled={!addingDeptJobTitleId}
                                        className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#e0e3e5] bg-white px-3 py-2 text-sm font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6] disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        <Plus className="h-3.5 w-3.5" /> {tDept("addStepButton")}
                                    </button>
                                </div>

                                <div className="flex justify-end pt-2">
                                    <button
                                        type="button"
                                        onClick={handleSaveDept}
                                        disabled={!isDeptDirty || isSavingDept}
                                        className="cursor-pointer rounded-lg bg-[#e3000f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#b40009] disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        {isSavingDept ? tDept("saving") : tDept("saveButton")}
                                    </button>
                                </div>
                            </>
                        )}
                    </section>
                        </>
                    )}

                    {activeTab === "production" && (
                    /* Khối Chuyền — 1 danh sách duy nhất (Line Leader -> ... -> Director) theo chính
                        Bộ phận đang chọn, dùng cho đơn OT "theo chuyền" (2026-08-24). Khác 2 khối trên:
                        không tách Group/Department, không hiển thị "ai đang giữ Chức vụ" (dữ liệu
                        chuyền đổi hàng ngày, danh sách người giữ ở đây không có ý nghĩa lâu dài). */
                    <section className="space-y-4 rounded-xl border border-[#e0e3e5] bg-white p-6 shadow-sm">
                        <div className="space-y-1">
                            <h3 className={sectionTitleClassName}>{tProd("sectionTitle")}</h3>
                            <p className="text-sm text-[#5e3f3a]">{tProd("description")}</p>
                        </div>

                        {isLoadingProductionSteps ? (
                            <p className="text-sm text-[#5e3f3a]">{tProd("loadingSteps")}</p>
                        ) : (
                            <>
                                {productionSteps.length === 0 && <p className="text-sm text-[#5e3f3a]">{tProd("noSteps")}</p>}

                                {productionSteps.length > 0 && (
                                    <ol className="space-y-2">
                                        {productionSteps.map((step, index) => (
                                            <li
                                                key={step.jobTitleId}
                                                ref={productionDrag.registerNode(step.jobTitleId)}
                                                draggable
                                                onDragStart={productionDrag.handleDragStart(index)}
                                                onDragOver={productionDrag.handleDragOver(index)}
                                                onDragEnd={productionDrag.handleDragEnd}
                                                className={`relative flex flex-wrap items-center gap-2 rounded-lg border p-3 transition-[box-shadow,border-color,background-color] duration-150 lg:flex-nowrap ${
                                                    productionDrag.dragIndex === index
                                                        ? "z-10 scale-[1.01] border-[#e3000f] bg-[#fff4f2] shadow-lg ring-2 ring-[#e3000f]/25"
                                                        : "border-[#e0e3e5] bg-white"
                                                }`}
                                            >
                                                <span
                                                    title={tProd("dragHandleLabel")}
                                                    aria-label={tProd("dragHandleLabel")}
                                                    className="shrink-0 cursor-grab text-[#8a8f94] active:cursor-grabbing"
                                                >
                                                    <GripVertical className="h-4 w-4" />
                                                </span>
                                                <div className="flex w-[230px] shrink-0 items-center gap-2" title={`${step.jobTitleName} (${step.jobTitleCode}, cấp ${step.rankOrder})`}>
                                                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#191c1e] text-xs font-bold text-white">
                                                        {index + 1}
                                                    </span>
                                                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[#191c1e]">{step.jobTitleName}</span>
                                                    <span className="shrink-0 whitespace-nowrap text-xs text-[#8a8f94]">({step.jobTitleCode}, cấp {step.rankOrder})</span>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => handleToggleProductionSignature(index)}
                                                    title={tProd("toggleSignatureHint")}
                                                    className={`inline-flex min-w-[118px] shrink-0 cursor-pointer items-center justify-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-semibold transition ${
                                                        step.requiresSignature
                                                            ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                                            : "border-[#e0e3e5] bg-white text-[#8a8f94] hover:bg-[#f2f4f6]"
                                                    }`}
                                                >
                                                    {step.requiresSignature ? <Check size={11} /> : <X size={11} />}
                                                    {step.requiresSignature ? tProd("requiresSignatureYes") : tProd("requiresSignatureNo")}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleSetProductionResponsible(index)}
                                                    title={tProd("toggleResponsibleHint")}
                                                    className={`inline-flex min-w-[118px] shrink-0 cursor-pointer items-center justify-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-semibold transition ${
                                                        step.isResponsible
                                                            ? "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                                                            : "border-[#e0e3e5] bg-white text-[#8a8f94] hover:bg-[#f2f4f6]"
                                                    }`}
                                                >
                                                    <Star size={11} fill={step.isResponsible ? "currentColor" : "none"} />
                                                    {step.isResponsible ? tProd("isResponsibleYes") : tProd("isResponsibleNo")}
                                                </button>
                                                <div className="ml-auto flex shrink-0 items-center gap-1">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveProductionStep(index)}
                                                        title={tProd("removeStep")}
                                                        aria-label={tProd("removeStep")}
                                                        className="cursor-pointer rounded-lg border border-[#e9bcb6] bg-white p-1.5 text-[#930006] transition hover:bg-[#fff4f2]"
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </button>
                                                </div>
                                            </li>
                                        ))}
                                    </ol>
                                )}

                                <div className="flex flex-wrap items-center gap-2 border-t border-[#e0e3e5] pt-4">
                                    <select
                                        value={addingProductionJobTitleId}
                                        onChange={(event) => setAddingProductionJobTitleId(event.target.value ? Number(event.target.value) : "")}
                                        className="h-10 flex-1 min-w-[220px] rounded-lg border border-[#e0e3e5] bg-white px-3 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3]"
                                    >
                                        <option value="">{tProd("fieldAddJobTitlePlaceholder")}</option>
                                        {availableProductionJobTitles.map((jobTitle) => (
                                            <option key={jobTitle.id} value={jobTitle.id}>
                                                {jobTitle.name} ({jobTitle.code}, cấp {jobTitle.rankOrder})
                                            </option>
                                        ))}
                                    </select>
                                    <button
                                        type="button"
                                        onClick={handleAddProductionStep}
                                        disabled={!addingProductionJobTitleId}
                                        className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#e0e3e5] bg-white px-3 py-2 text-sm font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6] disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        <Plus className="h-3.5 w-3.5" /> {tProd("addStepButton")}
                                    </button>
                                </div>
                                {productionSigningMinNotMet && <p className="text-xs text-[#930006]">{tProd("intermediateMinHint")}</p>}
                                {productionSigningLimitReached && <p className="text-xs text-[#9a5b00]">{tProd("intermediateLimitHint")}</p>}

                                <div className="flex justify-end pt-2">
                                    <button
                                        type="button"
                                        onClick={handleSaveProduction}
                                        disabled={!isProductionDirty || isSavingProduction || productionSigningMinNotMet}
                                        className="cursor-pointer rounded-lg bg-[#e3000f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#b40009] disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        {isSavingProduction ? tProd("saving") : tProd("saveButton")}
                                    </button>
                                </div>
                            </>
                        )}
                    </section>
                    )}
                </>
            )}
        </div>
    );
});

export default ApprovalStepManager;

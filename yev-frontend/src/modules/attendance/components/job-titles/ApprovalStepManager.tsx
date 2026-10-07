"use client";

import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { toast } from "react-toastify";
import { useTranslations } from "next-intl";
import { FolderOpen, Plus } from "lucide-react";

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
import ConfirmDialog from "@/components/common/ConfirmDialog";
import { useDragReorder } from "./useDragReorder";
import StepCard, { type StepCardLabels } from "./StepCard";
import StepHolders, { type StepHoldersLabels } from "./StepHolders";
import CoordinatorsBox, { type CoordinatorsBoxLabels } from "./CoordinatorsBox";

const sectionTitleClassName = "text-sm font-semibold text-[#191c1e]";
// Compact trigger for the selects in this screen (default input trigger is too tall/wide for a tree UI).
const compactSelectClassName =
    "h-8 w-full rounded-md border border-[#e0e3e5] bg-white px-2.5 pr-8 text-xs! text-[#191c1e] outline-none transition focus:border-[#e3000f]";

const toJobTitleOptions = (jobTitles: JobTitleDto[]): SelectOption[] =>
    jobTitles.map((jt) => ({
        value: jt.id,
        label: `${jt.name} (${jt.code}, cấp ${jt.rankOrder})`,
        searchText: `${jt.name} ${jt.code}`.toLowerCase(),
    }));

// Tab "Cây duyệt" (2026-08-10) — hợp nhất 2 tab trước đó ("Cây duyệt Bộ phận" + "Cây duyệt Nhóm")
// vào cùng 1 màn cho dễ cấu hình liền mạch: chọn 1 Bộ phận, rồi cấu hình lần lượt (1) cấp trung
// gian theo từng Nhóm con (Staff/Group Leader/Team Leader) và (2) cấp cuối của chính Bộ phận đó
// (Manager/Factory Manager/Director) — đúng thứ tự đơn sẽ đi qua thật (xem
// JobTitleApprovalChainService.ResolveChainCoreAsync: Nhóm trước, Bộ phận sau). Tab "Thử chuỗi
// duyệt" (ApprovalChainPreviewPanel) đã bị bỏ hẳn khỏi màn Danh mục — endpoint BE
// GET /api/JobTitle/resolve-chain vẫn còn, chỉ không còn UI xem trước ở FE.
// Không phải màn CRUD chuẩn nên implement ListHandle tối giản (openCreate no-op).
//
// Đợt polish giao diện (2026-09-05): 3 khối "danh sách bước" (Nhóm/Bộ phận/Chuyền) và 2 khối "Người
// phụ trách" (Nhóm/Bộ phận) trước đây copy gần y hệt JSX cho nhau (~110 dòng/khối bước, ~60 dòng/khối
// phụ trách) — tách ra dùng chung `StepCard`/`StepHolders`/`CoordinatorsBox` (cùng thư mục job-titles/),
// chỉ còn phần KHÁC BIỆT thật giữa 3 khối (khối Bộ phận không có "Người chịu trách nhiệm"; khối Chuyền
// có 3 nhánh nội dung "đang giữ" khác hẳn) nằm lại ở đây.
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
    // CreateOtFormPage.tsx (formMode "group"/"production"). Đổi tab CHỈ đổi phần hiển thị — state của
    // cả 2 tab đều nằm ở component này (không mất gì khi đổi qua lại), nên KHÔNG cần xác nhận huỷ.
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

    // Xác nhận huỷ thay đổi chưa lưu (2026-09-05) — đổi Bộ phận/Nhóm trước đây xoá thẳng state của
    // khối đang xem dù đang dirty, không cảnh báo gì. `pendingAction` giữ đúng thao tác đổi (đã biết
    // giá trị mới) để chạy khi người dùng xác nhận "Huỷ thay đổi" ở ConfirmDialog bên dưới.
    const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
    const applyOrConfirmDiscard = (isDirty: boolean, action: () => void) => {
        if (isDirty) {
            setPendingAction(() => action);
        } else {
            action();
        }
    };

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

    const selectDepartmentNow = (value: number | "") => {
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

    const handleSelectDepartment = (value: number | "") => {
        applyOrConfirmDiscard(isDeptDirty || isProductionDirty || isGroupDirty, () => selectDepartmentNow(value));
    };

    const selectGroupNow = (value: number | "") => {
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

    const handleSelectGroup = (value: number | "") => {
        applyOrConfirmDiscard(isGroupDirty, () => selectGroupNow(value));
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

    // One save for the whole "Theo Nhóm" tab: persists whichever of the two blocks has pending changes.
    const handleSaveAll = async () => {
        if (isGroupDirty && !groupSigningMinNotMet) await handleSaveGroup();
        if (isDeptDirty) await handleSaveDept();
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
                isLineScoped: jobTitle.isLineScoped ?? false,
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

    // ── Nhãn dùng chung cho StepCard/StepHolders/CoordinatorsBox — gom 1 lần ở đây thay vì gọi t(...)
    // rải rác trong vòng lặp render bên dưới. ──
    const groupStepLabels: StepCardLabels = {
        dragHandleLabel: tGroup("dragHandleLabel"),
        toggleSignatureHint: tGroup("toggleSignatureHint"),
        requiresSignatureYes: tGroup("requiresSignatureYes"),
        requiresSignatureNo: tGroup("requiresSignatureNo"),
        removeStep: tGroup("removeStep"),
        toggleResponsibleHint: tGroup("toggleResponsibleHint"),
        isResponsibleYes: tGroup("isResponsibleYes"),
        isResponsibleNo: tGroup("isResponsibleNo"),
    };
    const deptStepLabels: StepCardLabels = {
        dragHandleLabel: tDept("dragHandleLabel"),
        toggleSignatureHint: tDept("toggleSignatureHint"),
        requiresSignatureYes: tDept("requiresSignatureYes"),
        requiresSignatureNo: tDept("requiresSignatureNo"),
        removeStep: tDept("removeStep"),
    };
    const productionStepLabels: StepCardLabels = {
        dragHandleLabel: tProd("dragHandleLabel"),
        toggleSignatureHint: tProd("toggleSignatureHint"),
        requiresSignatureYes: tProd("requiresSignatureYes"),
        requiresSignatureNo: tProd("requiresSignatureNo"),
        removeStep: tProd("removeStep"),
        toggleResponsibleHint: tProd("toggleResponsibleHint"),
        isResponsibleYes: tProd("isResponsibleYes"),
        isResponsibleNo: tProd("isResponsibleNo"),
    };
    const groupHoldersLabels: StepHoldersLabels = {
        holdersLabel: tGroup("holdersLabel"),
        loadingEmployees: tGroup("loadingEmployees"),
        noHolders: tGroup("noHolders"),
        removeHolderHint: tGroup("removeHolderHint"),
        addHolderPlaceholder: tGroup("addHolderPlaceholder"),
    };
    const deptHoldersLabels: StepHoldersLabels = {
        holdersLabel: tDept("holdersLabel"),
        loadingEmployees: tDept("loadingEmployees"),
        noHolders: tDept("noHolders"),
        removeHolderHint: tDept("removeHolderHint"),
        addHolderPlaceholder: tDept("addHolderPlaceholder"),
    };
    const groupCoordinatorLabels: CoordinatorsBoxLabels = {
        title: tGroup("coordinatorsTitle"),
        hint: tGroup("coordinatorsHint"),
        label: tGroup("coordinatorsLabel"),
        loading: tGroup("loadingCoordinators"),
        noCoordinators: tGroup("noCoordinators"),
        notLinked: tGroup("coordinatorNotLinked"),
        notLinkedHint: tGroup("coordinatorNotLinkedHint"),
        removeHint: tGroup("removeCoordinatorHint"),
        addPlaceholder: tGroup("addCoordinatorPlaceholder"),
    };
    const deptCoordinatorLabels: CoordinatorsBoxLabels = {
        title: tDept("coordinatorsTitle"),
        hint: tDept("coordinatorsHint"),
        label: tDept("coordinatorsLabel"),
        loading: tDept("loadingCoordinators"),
        noCoordinators: tDept("noCoordinators"),
        notLinked: tDept("coordinatorNotLinked"),
        notLinkedHint: tDept("coordinatorNotLinkedHint"),
        removeHint: tDept("removeCoordinatorHint"),
        addPlaceholder: tDept("addCoordinatorPlaceholder"),
    };

    // Số thứ tự HIỂN THỊ của khối Bộ phận nối tiếp ngay sau khối Nhóm — đơn đi qua Nhóm TRƯỚC, Bộ phận
    // SAU (comment đầu file) nên đây là 1 chuỗi duyệt liền mạch, không phải 2 chuỗi độc lập đánh số
    // riêng (2026-09-05, trước đây cả 2 khối cùng đánh lại từ 1, dễ hiểu lầm là 2 chuỗi tách biệt).
    const deptStepNumberOffset = groupSteps.length;

    const loadingStepsSkeleton = (
        <div className="space-y-2">
            <div className="h-14 animate-pulse rounded-lg bg-[#f1f5f9]" />
            <div className="h-14 animate-pulse rounded-lg bg-[#f1f5f9]" />
        </div>
    );

    return (
        <div className="space-y-4">
            <section className="flex items-center gap-3 rounded-lg border border-[#e0e3e5] bg-white px-3 py-2 shadow-sm">
                <span className="shrink-0 text-xs font-semibold uppercase tracking-[0.1em] text-[#5e3f3a]">{tDept("fieldDepartment")}</span>
                <div className="w-64">
                    <SearchableSelect
                        options={departmentOptions}
                        value={departmentId}
                        onChange={handleSelectDepartment}
                        placeholder={tDept("fieldDepartmentPlaceholder")}
                        disabled={isLoadingOptions}
                        triggerClassName={compactSelectClassName}
                    />
                </div>
                {activeTab === "group" && typeof departmentId === "number" && (
                    <>
                        <span className="ml-2 shrink-0 text-xs font-semibold uppercase tracking-[0.1em] text-[#5e3f3a]">{tGroup("fieldGroup")}</span>
                        <div className="w-64">
                            <SearchableSelect
                                options={groupOptions}
                                value={groupId}
                                onChange={handleSelectGroup}
                                placeholder={tGroup("fieldGroupPlaceholder")}
                                disabled={isLoadingOptions}
                                triggerClassName={compactSelectClassName}
                            />
                        </div>
                    </>
                )}
                {activeTab === "group" && typeof departmentId === "number" && (
                    <button
                        type="button"
                        onClick={handleSaveAll}
                        disabled={!(isGroupDirty || isDeptDirty) || isSavingGroup || isSavingDept || groupSigningMinNotMet}
                        className="ml-auto cursor-pointer rounded-md bg-[#e3000f] px-3 py-1.5 text-xs! font-semibold! text-white transition hover:bg-[#b40009] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {isSavingGroup || isSavingDept ? tGroup("saving") : tGroup("saveButton")}
                    </button>
                )}
            </section>

            {typeof departmentId === "number" && (
                <>
                    <div className="flex flex-wrap gap-1 border-b border-[#e0e3e5]">
                        {(["group", "production"] as const).map((tab) => (
                            <button
                                key={tab}
                                type="button"
                                onClick={() => setActiveTab(tab)}
                                className={`cursor-pointer border-b-2 px-3 py-1.5 text-xs! font-semibold! transition ${
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
                        // Layout 2 cột "canvas + inspector" (2026-09-16): pipeline hợp nhất Nhóm → Bộ
                        // phận bên trái là trọng tâm (đọc liền mạch thành 1 hành trình duyệt, đánh số
                        // xuyên suốt qua deptStepNumberOffset — không đổi gì ở phần state/logic, chỉ gộp
                        // lại chỗ hiển thị); cột phải cố định (sticky) gom mọi thứ THUỘC VỀ CẤU HÌNH —
                        // chọn Nhóm, người phụ trách 2 cấp — để pipeline không bị ngắt mạch bởi các khối
                        // chọn lựa xen giữa như bố cục cũ (2 card xếp chồng, mỗi card tự chứa selector
                        // + người phụ trách + danh sách bước).
                        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_300px]">
                            <div className="order-2 space-y-4 rounded-xl border border-[#e0e3e5] bg-white p-4 shadow-sm lg:order-1">
                                {/* Cấp trung gian — theo Nhóm con của Bộ phận đang chọn (đơn đi qua khối này TRƯỚC) */}
                                <div>
                                    <div className="mb-2 flex items-center gap-1.5">
                                        <FolderOpen className="h-4 w-4 text-[#e3000f]" />
                                        <h3 className={sectionTitleClassName}>{tGroup("sectionTitle")}</h3>
                                        <div className="h-px flex-1 bg-[#e0e3e5]" />
                                    </div>

                                    {typeof groupId !== "number" ? (
                                        <p className="text-sm italic text-[#8a8f94]">{tGroup("chooseGroupHint")}</p>
                                    ) : isLoadingGroupSteps ? (
                                        loadingStepsSkeleton
                                    ) : (
                                        <>
                                            {groupSteps.length === 0 && <p className="mb-2 text-sm text-[#5e3f3a]">{tGroup("noSteps")}</p>}

                                            {groupSteps.length > 0 && (
                                                <ol>
                                                    {groupSteps.map((step, index) => (
                                                        <StepCard
                                                            key={step.jobTitleId}
                                                            registerNodeRef={groupDrag.registerNode(step.jobTitleId)}
                                                            isDragging={groupDrag.dragIndex === index}
                                                            onDragStart={groupDrag.handleDragStart(index)}
                                                            onDragOver={groupDrag.handleDragOver(index)}
                                                            onDragEnd={groupDrag.handleDragEnd}
                                                            displayNumber={index + 1}
                                                            jobTitleName={step.jobTitleName}
                                                            jobTitleCode={step.jobTitleCode}
                                                            rankOrder={step.rankOrder}
                                                            requiresSignature={step.requiresSignature}
                                                            onToggleSignature={() => handleToggleGroupSignature(index)}
                                                            isResponsible={step.isResponsible}
                                                            onToggleResponsible={() => handleSetGroupResponsible(index)}
                                                            onRemove={() => handleRemoveGroupStep(index)}
                                                            labels={groupStepLabels}
                                                            footer={
                                                                <StepHolders
                                                                    holders={groupEmployees.filter((e) => e.jobTitleId === step.jobTitleId)}
                                                                    isLoadingEmployees={isLoadingGroupEmployees}
                                                                    removingHolderId={assigningGroupEmployeeId}
                                                                    onRemoveHolder={(holder) => handleAssignGroupJobTitle(holder as EmployeeDto, "")}
                                                                    addOptions={buildHolderOptions(groupEmployees, step.jobTitleId)}
                                                                    addingValue={addingGroupHolderByJobTitle[step.jobTitleId] ?? ""}
                                                                    onAddChange={(v) => handlePickGroupHolder(step.jobTitleId, v)}
                                                                    labels={groupHoldersLabels}
                                                                />
                                                            }
                                                        />
                                                    ))}
                                                </ol>
                                            )}

                                            <div className="flex flex-wrap items-center gap-2 border-t border-[#e0e3e5] pt-3">
                                                <div className="w-64 max-w-full">
                                                    <SearchableSelect
                                                        options={toJobTitleOptions(availableGroupJobTitles)}
                                                        value={addingGroupJobTitleId}
                                                        onChange={setAddingGroupJobTitleId}
                                                        placeholder={tGroup("fieldAddJobTitlePlaceholder")}
                                                        triggerClassName={compactSelectClassName}
                                                    />
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={handleAddGroupStep}
                                                    disabled={!addingGroupJobTitleId}
                                                    className="flex h-8 cursor-pointer items-center gap-1 rounded-md border border-[#e0e3e5] bg-white px-2.5 text-xs! font-semibold! text-[#191c1e] transition hover:bg-[#f2f4f6] disabled:cursor-not-allowed disabled:opacity-50"
                                                >
                                                    <Plus className="h-3.5 w-3.5" /> {tGroup("addStepButton")}
                                                </button>
                                            </div>
                                            {groupSigningMinNotMet && <p className="text-xs text-[#930006]">{tGroup("intermediateMinHint")}</p>}
                                            {groupSigningLimitReached && <p className="text-xs text-[#9a5b00]">{tGroup("intermediateLimitHint")}</p>}

                                        </>
                                    )}
                                </div>

                                {/* Cấp cuối — theo chính Bộ phận đang chọn (đơn đi qua khối này SAU khối Nhóm) */}
                                <div>
                                    <div className="mb-2 flex items-center gap-1.5">
                                        <FolderOpen className="h-4 w-4 text-[#e3000f]" />
                                        <h3 className={sectionTitleClassName}>{tDept("sectionTitle")}</h3>
                                        <div className="h-px flex-1 bg-[#e0e3e5]" />
                                    </div>

                                    {isLoadingDeptSteps ? (
                                        loadingStepsSkeleton
                                    ) : (
                                        <>
                                            {deptSteps.length === 0 && <p className="mb-2 text-sm text-[#5e3f3a]">{tDept("noSteps")}</p>}

                                            {deptSteps.length > 0 && (
                                                <ol>
                                                    {deptSteps.map((step, index) => (
                                                        <StepCard
                                                            key={step.jobTitleId}
                                                            registerNodeRef={deptDrag.registerNode(step.jobTitleId)}
                                                            isDragging={deptDrag.dragIndex === index}
                                                            onDragStart={deptDrag.handleDragStart(index)}
                                                            onDragOver={deptDrag.handleDragOver(index)}
                                                            onDragEnd={deptDrag.handleDragEnd}
                                                            displayNumber={deptStepNumberOffset + index + 1}
                                                            jobTitleName={step.jobTitleName}
                                                            jobTitleCode={step.jobTitleCode}
                                                            rankOrder={step.rankOrder}
                                                            requiresSignature={step.requiresSignature}
                                                            onToggleSignature={() => handleToggleDeptSignature(index)}
                                                            onRemove={() => handleRemoveDeptStep(index)}
                                                            labels={deptStepLabels}
                                                            footer={
                                                                <StepHolders
                                                                    holders={deptEmployees.filter((e) => e.jobTitleId === step.jobTitleId)}
                                                                    isLoadingEmployees={isLoadingDeptEmployees}
                                                                    removingHolderId={assigningDeptEmployeeId}
                                                                    onRemoveHolder={(holder) => handleAssignDeptJobTitle(holder as EmployeeDto, "")}
                                                                    addOptions={buildHolderOptions(deptEmployees, step.jobTitleId)}
                                                                    addingValue={addingDeptHolderByJobTitle[step.jobTitleId] ?? ""}
                                                                    onAddChange={(v) => handlePickDeptHolder(step.jobTitleId, v)}
                                                                    labels={deptHoldersLabels}
                                                                />
                                                            }
                                                        />
                                                    ))}
                                                </ol>
                                            )}

                                            <div className="flex flex-wrap items-center gap-2 border-t border-[#e0e3e5] pt-3">
                                                <div className="w-64 max-w-full">
                                                    <SearchableSelect
                                                        options={toJobTitleOptions(availableDeptJobTitles)}
                                                        value={addingDeptJobTitleId}
                                                        onChange={setAddingDeptJobTitleId}
                                                        placeholder={tDept("fieldAddJobTitlePlaceholder")}
                                                        triggerClassName={compactSelectClassName}
                                                    />
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={handleAddDeptStep}
                                                    disabled={!addingDeptJobTitleId}
                                                    className="flex h-8 cursor-pointer items-center gap-1 rounded-md border border-[#e0e3e5] bg-white px-2.5 text-xs! font-semibold! text-[#191c1e] transition hover:bg-[#f2f4f6] disabled:cursor-not-allowed disabled:opacity-50"
                                                >
                                                    <Plus className="h-3.5 w-3.5" /> {tDept("addStepButton")}
                                                </button>
                                            </div>

                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Sidebar cấu hình — người phụ trách 2 cấp gộp 1 thẻ, cố định khi cuộn */}
                            <aside className="order-1 space-y-4 lg:sticky lg:top-6 lg:order-2 lg:self-start">
                                <div className="divide-y divide-[#e0e3e5] rounded-lg border border-[#e0e3e5] bg-white shadow-sm">
                                {typeof groupId === "number" && canManageGroupCoordinators && (
                                    <CoordinatorsBox
                                        embedded
                                        isLoading={isLoadingGroupCoordinators}
                                        coordinators={groupCoordinators}
                                        onRemove={handleRemoveGroupCoordinator}
                                        isSaving={isSavingGroupCoordinators}
                                        addOptions={buildCoordinatorOptions(groupEmployees, new Set(groupCoordinators.map((c) => c.employeeId)))}
                                        addingValue={addingGroupCoordinatorEmployeeId}
                                        onAddChange={handleAddGroupCoordinator}
                                        labels={groupCoordinatorLabels}
                                    />
                                )}

                                {canManageDeptCoordinators && (
                                    <CoordinatorsBox
                                        embedded
                                        isLoading={isLoadingDeptCoordinators}
                                        coordinators={deptCoordinators}
                                        onRemove={handleRemoveDeptCoordinator}
                                        isSaving={isSavingDeptCoordinators}
                                        addOptions={buildCoordinatorOptions(deptEmployees, new Set(deptCoordinators.map((c) => c.employeeId)))}
                                        addingValue={addingDeptCoordinatorEmployeeId}
                                        onAddChange={handleAddDeptCoordinator}
                                        labels={deptCoordinatorLabels}
                                    />
                                )}
                                </div>
                            </aside>
                        </div>
                    )}

                    {activeTab === "production" && (
                    /* Khối Chuyền — 1 danh sách duy nhất (Line Leader -> ... -> Director) theo chính
                        Bộ phận đang chọn, dùng cho đơn OT "theo chuyền" (2026-08-24). Khác 2 khối trên:
                        không tách Group/Department, không hiển thị "ai đang giữ Chức vụ" (dữ liệu
                        chuyền đổi hàng ngày, danh sách người giữ ở đây không có ý nghĩa lâu dài). */
                    <section className="space-y-3 rounded-xl border border-[#e0e3e5] bg-white p-4 shadow-sm">
                        <div className="flex items-center gap-1.5">
                            <h3 className={sectionTitleClassName}>{tProd("sectionTitle")}</h3>
                        </div>

                        {isLoadingProductionSteps ? (
                            loadingStepsSkeleton
                        ) : (
                            <>
                                {productionSteps.length === 0 && <p className="text-sm text-[#5e3f3a]">{tProd("noSteps")}</p>}

                                {productionSteps.length > 0 && (
                                    <ol>
                                        {productionSteps.map((step, index) => (
                                            <StepCard
                                                key={step.jobTitleId}
                                                registerNodeRef={productionDrag.registerNode(step.jobTitleId)}
                                                isDragging={productionDrag.dragIndex === index}
                                                onDragStart={productionDrag.handleDragStart(index)}
                                                onDragOver={productionDrag.handleDragOver(index)}
                                                onDragEnd={productionDrag.handleDragEnd}
                                                displayNumber={index + 1}
                                                jobTitleName={step.jobTitleName}
                                                jobTitleCode={step.jobTitleCode}
                                                rankOrder={step.rankOrder}
                                                requiresSignature={step.requiresSignature}
                                                onToggleSignature={() => handleToggleProductionSignature(index)}
                                                isResponsible={step.isResponsible}
                                                onToggleResponsible={() => handleSetProductionResponsible(index)}
                                                onRemove={() => handleRemoveProductionStep(index)}
                                                labels={productionStepLabels}
                                                footer={
                                                    step.terminalLevel === 0 && step.isLineScoped ? null : step.terminalLevel === 0 && !step.isLineScoped ? (
                                                        <StepHolders
                                                            holders={deptEmployees.filter((e) => e.jobTitleId === step.jobTitleId)}
                                                            isLoadingEmployees={isLoadingDeptEmployees}
                                                            removingHolderId={assigningDeptEmployeeId}
                                                            onRemoveHolder={(holder) => handleAssignDeptJobTitle(holder as EmployeeDto, "")}
                                                            addOptions={buildHolderOptions(deptEmployees, step.jobTitleId)}
                                                            addingValue={addingDeptHolderByJobTitle[step.jobTitleId] ?? ""}
                                                            onAddChange={(v) => handlePickDeptHolder(step.jobTitleId, v)}
                                                            labels={deptHoldersLabels}
                                                        />
                                                    ) : null
                                                }
                                            />
                                        ))}
                                    </ol>
                                )}

                                <div className="flex flex-wrap items-center gap-2 border-t border-[#e0e3e5] pt-3">
                                    <div className="w-64 max-w-full">
                                        <SearchableSelect
                                            options={toJobTitleOptions(availableProductionJobTitles)}
                                            value={addingProductionJobTitleId}
                                            onChange={setAddingProductionJobTitleId}
                                            placeholder={tProd("fieldAddJobTitlePlaceholder")}
                                                        triggerClassName={compactSelectClassName}
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleAddProductionStep}
                                        disabled={!addingProductionJobTitleId}
                                        className="flex h-8 cursor-pointer items-center gap-1 rounded-md border border-[#e0e3e5] bg-white px-2.5 text-xs! font-semibold! text-[#191c1e] transition hover:bg-[#f2f4f6] disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        <Plus className="h-3.5 w-3.5" /> {tProd("addStepButton")}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleSaveProduction}
                                        disabled={!isProductionDirty || isSavingProduction || productionSigningMinNotMet}
                                        className="ml-auto cursor-pointer rounded-md bg-[#e3000f] px-3 py-1.5 text-xs! font-semibold! text-white transition hover:bg-[#b40009] disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        {isSavingProduction ? tProd("saving") : tProd("saveButton")}
                                    </button>
                                </div>
                                {productionSigningMinNotMet && <p className="text-xs text-[#930006]">{tProd("intermediateMinHint")}</p>}
                                {productionSigningLimitReached && <p className="text-xs text-[#9a5b00]">{tProd("intermediateLimitHint")}</p>}

                            </>
                        )}
                    </section>
                    )}
                </>
            )}

            <ConfirmDialog
                isOpen={pendingAction !== null}
                title={tDept("discardChangesTitle")}
                message={tDept("discardChangesMessage")}
                approveLabel={tDept("discardChangesConfirm")}
                onApprove={() => {
                    pendingAction?.();
                    setPendingAction(null);
                }}
                onDenied={() => setPendingAction(null)}
            />
        </div>
    );
});

export default ApprovalStepManager;

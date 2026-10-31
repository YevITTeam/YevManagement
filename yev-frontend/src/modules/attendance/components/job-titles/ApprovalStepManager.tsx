"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";
import { usePersistedTab } from "@/modules/common/hooks/usePersistedTab";
import { toast } from "react-toastify";
import { useTranslations } from "next-intl";
import { FolderOpen, Plus } from "lucide-react";

import { DepartmentApprovalStepApi } from "@/modules/attendance/api/department-approval-step.api";
import { GroupApprovalStepApi } from "@/modules/attendance/api/group-approval-step.api";
import { ProductionApprovalStepApi } from "@/modules/attendance/api/production-approval-step.api";
import { DepartmentApprovalStepCoordinatorApi } from "@/modules/attendance/api/department-approval-step-coordinator.api";
import { GroupApprovalStepCoordinatorApi } from "@/modules/attendance/api/group-approval-step-coordinator.api";
import { GroupApi } from "@/modules/attendance/api/group.api";
import { WorkshopApi } from "@/modules/attendance/api/workshop.api";
import { JobTitleApi } from "@/modules/attendance/api/job-title.api";
import { EmployeeApi } from "@/modules/attendance/api/employee.api";
import type { ApprovalTreeDepartmentDto, DepartmentApprovalStepDto } from "@/modules/attendance/types/department-approval-step.dto";
import type { GroupApprovalStepDto, GroupBorrowedApproversDto } from "@/modules/attendance/types/group-approval-step.dto";
import type { ProductionApprovalStepDto } from "@/modules/attendance/types/production-approval-step.dto";
import type { DepartmentApprovalStepCoordinatorDto } from "@/modules/attendance/types/department-approval-step-coordinator.dto";
import type { GroupApprovalStepCoordinatorDto } from "@/modules/attendance/types/group-approval-step-coordinator.dto";
import type { GroupDto } from "@/modules/attendance/types/group.dto";
import type { WorkshopDto } from "@/modules/attendance/types/workshop.dto";
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

const TEAM_LEADER_CODE = "TL";
const EMPTY_BORROWED: GroupBorrowedApproversDto = { approvers: [], candidates: [] };

const sectionTitleClassName = "text-sm font-semibold text-[#191c1e]";
// Compact trigger for the selects in this screen (default input trigger is too tall/wide for a tree UI).
const compactSelectClassName =
    "h-8 w-full rounded-md border border-[#e0e3e5] bg-white px-2.5 pr-8 text-xs! text-[#191c1e] outline-none transition focus:border-[#e3000f]";

const toJobTitleOptions = (jobTitles: JobTitleDto[], codeWithRank: (code: string, rank: number) => string): SelectOption[] =>
    jobTitles.map((jt) => ({
        value: jt.id,
        label: `${jt.name} (${codeWithRank(jt.code, jt.rankOrder)})`,
        searchText: `${jt.name} ${jt.code}`.toLowerCase(),
    }));

// Group steps then department steps in one screen, matching the real chain order (ResolveChainCoreAsync:
// group first, department after). Not a standard CRUD list, so ListHandle is minimal (openCreate no-op).
const ApprovalStepManager = forwardRef<ListHandle, ListToolbarProps>(function ApprovalStepManager(
    { onLoadingChange },
    ref
) {
    const tDept = useTranslations("Attendance.DepartmentApprovalStep");
    const tGroup = useTranslations("Attendance.GroupApprovalStep");
    const tProd = useTranslations("Attendance.ProductionApprovalStep");
    const tJobTitle = useTranslations("Attendance.JobTitle");
    const codeWithRank = (code: string, rank: number) => tJobTitle("codeWithRank", { code, rank });
    const { user } = useAuth();
    // Coordinators can open this screen but lack *Coordinator.View, so hide these blocks or they'd hit 403.
    const canManageDeptCoordinators = hasPermission(user, "Attendance.DepartmentApprovalStepCoordinator.View");
    const canManageGroupCoordinators = hasPermission(user, "Attendance.GroupApprovalStepCoordinator.View");

    const [departments, setDepartments] = useState<ApprovalTreeDepartmentDto[]>([]);
    const [groups, setGroups] = useState<GroupDto[]>([]);
    const [deptJobTitles, setDeptJobTitles] = useState<JobTitleDto[]>([]);
    const [groupJobTitles, setGroupJobTitles] = useState<JobTitleDto[]>([]);
    // The production chain accepts both intermediate and terminal job titles in one list (ProductionApprovalStepService.ReplaceAsync).
    const [allJobTitles, setAllJobTitles] = useState<JobTitleDto[]>([]);
    const [departmentId, setDepartmentId] = useState<number | "">("");
    // Workshop scoping Manager holders and groups; defaults to the first workshop until one is picked.
    const [workshops, setWorkshops] = useState<WorkshopDto[]>([]);
    const [pickedWorkshopId, setPickedWorkshopId] = useState<number | "">("");
    const workshopId: number | "" = pickedWorkshopId === "" ? (workshops.length > 0 ? workshops[0].id : "") : pickedWorkshopId;
    const [isLoadingOptions, setIsLoadingOptions] = useState(true);
    // "group" and "production" mirror the two create-form modes. All state lives here, so switching tabs
    // loses nothing and needs no discard confirmation.
    const [activeTab, setActiveTab] = usePersistedTab<"group" | "production">("ot-approval-steps-tab", ["group", "production"], "group");

    // ── Production block ──
    const [productionSteps, setProductionSteps] = useState<ProductionApprovalStepDto[]>([]);
    const [addingProductionJobTitleId, setAddingProductionJobTitleId] = useState<number | "">("");
    const [isLoadingProductionSteps, setIsLoadingProductionSteps] = useState(false);
    const [isSavingProduction, setIsSavingProduction] = useState(false);
    const [isProductionDirty, setIsProductionDirty] = useState(false);

    // ── Department (terminal) block ──
    const [deptSteps, setDeptSteps] = useState<DepartmentApprovalStepDto[]>([]);
    const [addingDeptJobTitleId, setAddingDeptJobTitleId] = useState<number | "">("");
    const [isLoadingDeptSteps, setIsLoadingDeptSteps] = useState(false);
    const [isSavingDept, setIsSavingDept] = useState(false);
    const [isDeptDirty, setIsDeptDirty] = useState(false);
    // Holders = employees of the department that hold a Job Title (small); search results feed the "add" pickers
    // (a department can have thousands of employees, so they are searched on the server, not preloaded).
    const [deptEmployees, setDeptEmployees] = useState<EmployeeDto[]>([]);
    const [deptSearchResults, setDeptSearchResults] = useState<EmployeeDto[]>([]);
    const [deptSearchQuery, setDeptSearchQuery] = useState("");
    const deptSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const deptPool = [...deptEmployees, ...deptSearchResults.filter((r) => !deptEmployees.some((e) => e.id === r.id))];
    const [isLoadingDeptEmployees, setIsLoadingDeptEmployees] = useState(false);
    const [assigningDeptEmployeeId, setAssigningDeptEmployeeId] = useState<number | null>(null);
    const [addingDeptHolderByJobTitle, setAddingDeptHolderByJobTitle] = useState<Record<number, number | "">>({});
    const [deptCoordinators, setDeptCoordinators] = useState<DepartmentApprovalStepCoordinatorDto[]>([]);
    const [isLoadingDeptCoordinators, setIsLoadingDeptCoordinators] = useState(false);
    const [isSavingDeptCoordinators, setIsSavingDeptCoordinators] = useState(false);
    const [addingDeptCoordinatorEmployeeId, setAddingDeptCoordinatorEmployeeId] = useState<number | "">("");

    // ── Group (intermediate) block ──
    const [groupId, setGroupId] = useState<number | "">("");
    const [groupSteps, setGroupSteps] = useState<GroupApprovalStepDto[]>([]);
    const [addingGroupJobTitleId, setAddingGroupJobTitleId] = useState<number | "">("");
    const [isLoadingGroupSteps, setIsLoadingGroupSteps] = useState(false);
    const [isSavingGroup, setIsSavingGroup] = useState(false);
    const [isGroupDirty, setIsGroupDirty] = useState(false);
    const [groupEmployees, setGroupEmployees] = useState<EmployeeDto[]>([]);
    const [groupBorrowed, setGroupBorrowed] = useState<GroupBorrowedApproversDto>(EMPTY_BORROWED);
    const [isLoadingGroupEmployees, setIsLoadingGroupEmployees] = useState(false);
    const [assigningGroupEmployeeId, setAssigningGroupEmployeeId] = useState<number | null>(null);
    const [addingGroupHolderByJobTitle, setAddingGroupHolderByJobTitle] = useState<Record<number, number | "">>({});
    const [groupCoordinators, setGroupCoordinators] = useState<GroupApprovalStepCoordinatorDto[]>([]);
    const [isLoadingGroupCoordinators, setIsLoadingGroupCoordinators] = useState(false);
    const [isSavingGroupCoordinators, setIsSavingGroupCoordinators] = useState(false);
    const [addingGroupCoordinatorEmployeeId, setAddingGroupCoordinatorEmployeeId] = useState<number | "">("");

    // Holds the pending department/group change, run only after the user confirms discarding unsaved edits.
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
        // getMyDepartments limits coordinators to their own departments, avoiding 403s from the APIs below.
        Promise.all([
            DepartmentApprovalStepApi.getMyDepartments(),
            GroupApi.getAllGroups(),
            JobTitleApi.getAllJobTitles(),
            WorkshopApi.getAllWorkshops().catch(() => [] as WorkshopDto[]),
        ])
            .then(([departmentData, groupData, jobTitleData, workshopData]) => {
                setWorkshops(workshopData);
                setDepartments(departmentData);
                setGroups(groupData);
                // Terminal levels for the department block, intermediate levels for the group block.
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

    const fetchDeptEmployees = (targetDepartmentId: number, targetWorkshopId: number | "" = workshopId) => {
        setIsLoadingDeptEmployees(true);
        EmployeeApi.getEmployeesByDepartment(targetDepartmentId, typeof targetWorkshopId === "number" ? targetWorkshopId : undefined, { jobTitled: true })
            .then((data) => setDeptEmployees(data))
            .catch((err) => {
                console.error(err);
                toast.error(getApiErrorMessage(err, tDept("loadEmployeesError")));
            })
            .finally(() => setIsLoadingDeptEmployees(false));
    };

    const handleDeptPickerQuery = (query: string) => {
        if (deptSearchTimer.current) clearTimeout(deptSearchTimer.current);
        deptSearchTimer.current = setTimeout(() => setDeptSearchQuery(query.trim()), 300);
    };

    useFetchEffect(
        () =>
            typeof departmentId === "number"
                ? EmployeeApi.getEmployeesByDepartment(departmentId, typeof workshopId === "number" ? workshopId : undefined, { keyword: deptSearchQuery || undefined, take: 30 })
                : Promise.resolve([]),
        [departmentId, workshopId, deptSearchQuery],
        setDeptSearchResults,
        tDept("loadEmployeesError"),
        (message) => toast.error(message)
    );

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

    const fetchGroupBorrowed = (targetGroupId: number) => {
        GroupApprovalStepApi.getBorrowedApprovers(targetGroupId)
            .then((data) => setGroupBorrowed(data))
            .catch((err) => {
                console.error(err);
                toast.error(getApiErrorMessage(err, tGroup("loadEmployeesError")));
            });
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
                if (canManageDept) fetchProductionSteps(departmentId);
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
        // The selected group no longer belongs to the new department.
        setGroupId("");
        setGroupSteps([]);
        setGroupEmployees([]);
        setGroupBorrowed(EMPTY_BORROWED);
        setGroupCoordinators([]);
        setAddingGroupJobTitleId("");
        setIsGroupDirty(false);
        if (typeof value === "number") {
            fetchDeptSteps(value);
            fetchDeptEmployees(value);
            fetchDeptCoordinators(value);
            if (departments.find((d) => d.id === value)?.canManage) fetchProductionSteps(value);
            else setActiveTab("group");
        }
    };

    const handleSelectDepartment = (value: number | "") => {
        applyOrConfirmDiscard(isDeptDirty || isProductionDirty || isGroupDirty, () => selectDepartmentNow(value));
    };

    const selectGroupNow = (value: number | "") => {
        setGroupId(value);
        setGroupSteps([]);
        setGroupEmployees([]);
        setGroupBorrowed(EMPTY_BORROWED);
        setGroupCoordinators([]);
        setAddingGroupJobTitleId("");
        setIsGroupDirty(false);
        if (typeof value === "number") {
            fetchGroupSteps(value);
            fetchGroupEmployees(value);
            fetchGroupBorrowed(value);
            fetchGroupCoordinators(value);
        }
    };

    const handleSelectGroup = (value: number | "") => {
        applyOrConfirmDiscard(isGroupDirty, () => selectGroupNow(value));
    };

    // Dedicated endpoint so tree coordinators (not just Admin) can assign within their department; BE recomputes
    // groupId/departmentId. The FE pre-check for assignNeedsGroupError saves a round trip for a known error.
    const handleAssignDeptJobTitle = async (employee: EmployeeDto, jobTitleId: number | "") => {
        if (typeof departmentId !== "number") return;
        const nextJobTitleId = jobTitleId === "" ? null : jobTitleId;
        const nextJobTitle = deptJobTitles.find((jt) => jt.id === nextJobTitleId);
        const nextTerminalLevel = nextJobTitle?.terminalLevel ?? 0;

        if (nextTerminalLevel === 0 && employee.groupId === null) {
            // Removing a terminal title from someone with no real group needs a group pick, which only the Employee form can do.
            toast.error(tDept("assignNeedsGroupError"));
            return;
        }

        setAssigningDeptEmployeeId(employee.id);
        try {
            const updated = await EmployeeApi.assignDepartmentJobTitle(employee.id, departmentId, nextJobTitleId, typeof workshopId === "number" ? workshopId : undefined);
            setDeptEmployees((current) => (current.some((e) => e.id === employee.id) ? current.map((e) => (e.id === employee.id ? updated : e)) : [...current, updated]));
            setDeptSearchResults((current) => current.map((e) => (e.id === employee.id ? updated : e)));
            toast.success(tDept("assignSuccess"));
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, tDept("assignError")));
        } finally {
            setAssigningDeptEmployeeId(null);
        }
    };

    // Intermediate titles are TerminalLevel=None, so BE keeps groupId/departmentId and changes only jobTitleId.
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

    const saveBorrowedApprovers = async (employeeId: number, nextEmployeeIds: number[]) => {
        if (typeof groupId !== "number") return;
        setAssigningGroupEmployeeId(employeeId);
        try {
            setGroupBorrowed(await GroupApprovalStepApi.replaceBorrowedApprovers(groupId, nextEmployeeIds));
            toast.success(tGroup("assignSuccess"));
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, tGroup("assignError")));
        } finally {
            setAssigningGroupEmployeeId(null);
        }
    };

    const handleRemoveGroupHolder = (holder: { id: number }) => {
        if (groupBorrowed.approvers.some((a) => a.employeeId === holder.id)) {
            return saveBorrowedApprovers(holder.id, groupBorrowed.approvers.filter((a) => a.employeeId !== holder.id).map((a) => a.employeeId));
        }
        const employee = groupEmployees.find((e) => e.id === holder.id);
        return employee ? handleAssignGroupJobTitle(employee, "") : undefined;
    };

    const handlePickDeptHolder = async (jobTitleId: number, employeeId: number | "") => {
        setAddingDeptHolderByJobTitle((current) => ({ ...current, [jobTitleId]: employeeId }));
        if (employeeId === "") return;
        const employee = deptPool.find((e) => e.id === employeeId);
        if (!employee) return;
        await handleAssignDeptJobTitle(employee, jobTitleId);
        setAddingDeptHolderByJobTitle((current) => ({ ...current, [jobTitleId]: "" }));
    };

    const handlePickGroupHolder = async (jobTitleId: number, employeeId: number | "") => {
        setAddingGroupHolderByJobTitle((current) => ({ ...current, [jobTitleId]: employeeId }));
        if (employeeId === "") return;
        if (groupBorrowed.candidates.some((c) => c.employeeId === employeeId)) {
            await saveBorrowedApprovers(employeeId, [...groupBorrowed.approvers.map((a) => a.employeeId), employeeId]);
            setAddingGroupHolderByJobTitle((current) => ({ ...current, [jobTitleId]: "" }));
            return;
        }
        const employee = groupEmployees.find((e) => e.id === employeeId);
        if (!employee) return;
        await handleAssignGroupJobTitle(employee, jobTitleId);
        setAddingGroupHolderByJobTitle((current) => ({ ...current, [jobTitleId]: "" }));
    };

    // Coordinators are picked manually from the unit's own employees, not inferred from job titles. Employees without
    // a linked account are allowed; their permissions take effect once Admin links the account.
    const handleAddDeptCoordinator = async (employeeId: number | "") => {
        setAddingDeptCoordinatorEmployeeId(employeeId);
        if (employeeId === "" || typeof departmentId !== "number") return;
        const employee = deptPool.find((e) => e.id === employeeId);
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

    // Excludes current coordinators and flags employees without a linked account, whose rights won't apply yet.
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

    // Team Leader step: own-group holders plus Team Leaders borrowed from other Groups of the Department.
    const buildGroupHolders = (step: GroupApprovalStepDto) => {
        const own = groupEmployees.filter((e) => e.jobTitleId === step.jobTitleId);
        if (step.jobTitleCode !== TEAM_LEADER_CODE) return own;
        const borrowed = groupBorrowed.approvers.map((a) => ({
            id: a.employeeId,
            lastName: a.lastName,
            firstName: a.firstName,
            code: a.employeeCode,
            badge: a.groupNameVn,
        }));
        return [...own, ...borrowed];
    };

    const buildBorrowCandidateOptions = (): SelectOption[] =>
        groupBorrowed.candidates.map((c) => ({
            value: c.employeeId,
            label: `${c.lastName} ${c.firstName} (${c.employeeCode}) — ${c.groupNameVn ?? ""}`,
            searchText: [c.lastName, c.firstName, `${c.firstName} ${c.lastName}`, c.employeeCode, c.groupNameVn ?? ""].join(" ").toLowerCase(),
        }));

    const departmentOptions: SelectOption[] = departments.map((d) => ({
        value: d.id,
        label: d.departmentNameVn,
        searchText: `${d.departmentNameVn} ${d.departmentCode}`.toLowerCase(),
    }));
    const selectedDepartment = departments.find((d) => d.id === departmentId);
    const canManageDept = selectedDepartment?.canManage ?? false;
    const groupOptions: SelectOption[] = groups
        .filter((g) => g.departmentId === departmentId && (workshopId === "" || g.workshopId === workshopId))
        .filter((g) => canManageDept || selectedDepartment?.groupIds.includes(g.id))
        .map((g) => ({
            value: g.id,
            label: g.groupNameVn,
            searchText: `${g.groupNameVn} ${g.groupCode}`.toLowerCase(),
        }));

    // ── Department block: add/remove/reorder/save ──
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

    // One save for the whole group tab: persists whichever of the two blocks has pending changes.
    const handleSaveAll = async () => {
        if (isGroupDirty && !groupSigningMinNotMet) await handleSaveGroup();
        if (isDeptDirty) await handleSaveDept();
    };

    // ── Production block: add/remove/reorder/save ──
    const usedProductionJobTitleIds = new Set(productionSteps.map((s) => s.jobTitleId));
    const availableProductionJobTitles = allJobTitles.filter((jt) => !usedProductionJobTitleIds.has(jt.id));

    // The printout has exactly 2 fixed "requester" boxes, counted from intermediate levels only; terminal levels have their own boxes.
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

    // ── Group block: add/remove/reorder/save ──
    const usedGroupJobTitleIds = new Set(groupSteps.map((s) => s.jobTitleId));
    const availableGroupJobTitles = groupJobTitles.filter((jt) => !usedGroupJobTitleIds.has(jt.id));

    // The YEV-22-024 printout has exactly 2 fixed "requester" boxes.
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
                canResubmit: false,
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

    const handleToggleGroupResubmit = (index: number) => {
        setGroupSteps((current) => current.map((step, i) => (i === index ? { ...step, canResubmit: !step.canResubmit } : step)));
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
                groupSteps.map((s) => ({ jobTitleId: s.jobTitleId, requiresSignature: s.requiresSignature, isResponsible: s.isResponsible, canResubmit: s.canResubmit }))
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

    const groupStepLabels: StepCardLabels = {
        dragHandleLabel: tGroup("dragHandleLabel"),
        toggleSignatureHint: tGroup("toggleSignatureHint"),
        requiresSignatureYes: tGroup("requiresSignatureYes"),
        requiresSignatureNo: tGroup("requiresSignatureNo"),
        removeStep: tGroup("removeStep"),
        toggleResponsibleHint: tGroup("toggleResponsibleHint"),
        isResponsibleYes: tGroup("isResponsibleYes"),
        isResponsibleNo: tGroup("isResponsibleNo"),
        toggleResubmitHint: tGroup("toggleResubmitHint"),
        canResubmitYes: tGroup("canResubmitYes"),
        canResubmitNo: tGroup("canResubmitNo"),
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

    // Department steps continue the group numbering: it is one continuous chain, not two.
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
                {workshops.length > 0 && (
                    <>
                        <span className="ml-2 shrink-0 text-xs font-semibold uppercase tracking-[0.1em] text-[#5e3f3a]">{tDept("fieldWorkshop")}</span>
                        <div className="w-44">
                            <SearchableSelect
                                options={workshops.map((w) => ({ value: w.id, label: w.workshopNameVn, searchText: w.workshopNameVn.toLowerCase() }))}
                                value={workshopId}
                                onChange={(v) => {
                                    setPickedWorkshopId(v);
                                    setGroupId("");
                                    setGroupSteps([]);
                                    setGroupEmployees([]);
                                    setGroupBorrowed(EMPTY_BORROWED);
                                    setGroupCoordinators([]);
                                    setIsGroupDirty(false);
                                    if (typeof departmentId === "number") fetchDeptEmployees(departmentId, v);
                                }}
                                placeholder={tDept("fieldWorkshopPlaceholder")}
                                disabled={isLoadingOptions}
                                triggerClassName={compactSelectClassName}
                            />
                        </div>
                    </>
                )}
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
                        {(canManageDept ? (["group", "production"] as const) : (["group"] as const)).map((tab) => (
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
                        // Left: the merged group → department pipeline; right: sticky config panel so selectors don't break the pipeline.
                        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_300px]">
                            <div className="order-2 space-y-4 rounded-xl border border-[#e0e3e5] bg-white p-4 shadow-sm lg:order-1">
                                {/* Intermediate levels — the form passes these first */}
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
                                                            canResubmit={step.canResubmit}
                                                            onToggleResubmit={() => handleToggleGroupResubmit(index)}
                                                            onRemove={() => handleRemoveGroupStep(index)}
                                                            labels={groupStepLabels}
                                                            footer={
                                                                <StepHolders
                                                                    holders={buildGroupHolders(step)}
                                                                    isLoadingEmployees={isLoadingGroupEmployees}
                                                                    removingHolderId={assigningGroupEmployeeId}
                                                                    onRemoveHolder={handleRemoveGroupHolder}
                                                                    addOptions={[
                                                                        ...buildHolderOptions(groupEmployees, step.jobTitleId),
                                                                        ...(step.jobTitleCode === TEAM_LEADER_CODE ? buildBorrowCandidateOptions() : []),
                                                                    ]}
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
                                                        options={toJobTitleOptions(availableGroupJobTitles, codeWithRank)}
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

                                {/* Terminal levels — after the group block */}
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
                                                            readOnly={!canManageDept}
                                                            footer={
                                                                <StepHolders
                                                                    holders={deptEmployees.filter((e) => e.jobTitleId === step.jobTitleId)}
                                                                    isLoadingEmployees={isLoadingDeptEmployees}
                                                                    removingHolderId={assigningDeptEmployeeId}
                                                                    onRemoveHolder={(holder) => handleAssignDeptJobTitle(holder as EmployeeDto, "")}
                                                                    addOptions={buildHolderOptions(deptPool, step.jobTitleId)}
                                                                    onAddQueryChange={handleDeptPickerQuery}
                                                                    addingValue={addingDeptHolderByJobTitle[step.jobTitleId] ?? ""}
                                                                    onAddChange={(v) => handlePickDeptHolder(step.jobTitleId, v)}
                                                                    labels={deptHoldersLabels}
                                                                    readOnly={!canManageDept}
                                                                />
                                                            }
                                                        />
                                                    ))}
                                                </ol>
                                            )}

                                            {canManageDept && <div className="flex flex-wrap items-center gap-2 border-t border-[#e0e3e5] pt-3">
                                                <div className="w-64 max-w-full">
                                                    <SearchableSelect
                                                        options={toJobTitleOptions(availableDeptJobTitles, codeWithRank)}
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
                                            </div>}

                                        </>
                                    )}
                                </div>
                            </div>

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
                                        addOptions={buildCoordinatorOptions(deptPool, new Set(deptCoordinators.map((c) => c.employeeId)))}
                                        onAddQueryChange={handleDeptPickerQuery}
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
                    /* No current holders shown: production staffing changes daily, so the list wouldn't mean much. */
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
                                                            addOptions={buildHolderOptions(deptPool, step.jobTitleId)}
                                                                    onAddQueryChange={handleDeptPickerQuery}
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
                                            options={toJobTitleOptions(availableProductionJobTitles, codeWithRank)}
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

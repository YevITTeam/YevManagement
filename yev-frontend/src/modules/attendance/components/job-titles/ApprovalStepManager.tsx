"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";
import { toast } from "react-toastify";
import { useTranslations } from "next-intl";
import { FolderOpen, Layers } from "lucide-react";

import { DepartmentApprovalStepApi } from "@/modules/attendance/api/department-approval-step.api";
import { GroupApprovalStepApi } from "@/modules/attendance/api/group-approval-step.api";
import { DepartmentApprovalStepCoordinatorApi } from "@/modules/attendance/api/department-approval-step-coordinator.api";
import { GroupApprovalStepCoordinatorApi } from "@/modules/attendance/api/group-approval-step-coordinator.api";
import { GroupApi } from "@/modules/attendance/api/group.api";
import { WorkshopApi } from "@/modules/attendance/api/workshop.api";
import { JobTitleApi } from "@/modules/attendance/api/job-title.api";
import { EmployeeApi } from "@/modules/attendance/api/employee.api";
import type { ApprovalTreeDepartmentDto, DepartmentApprovalStepDto } from "@/modules/attendance/types/department-approval-step.dto";
import type { GroupApprovalStepDto, GroupBorrowedApproverDto, GroupBorrowedApproversDto } from "@/modules/attendance/types/group-approval-step.dto";
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
import { MultiSelect } from "@/components/ui/MultiSelect";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import FormDialog from "@/components/common/FormDialog";
import { useDragReorder } from "./useDragReorder";
import StepCard, { StepColumnHeaders, StepSectionHeader, type StepCardLabels } from "./StepCard";
import StepHolders, { type StepHoldersLabels } from "./StepHolders";
import LevelMembers, { type LevelMembersLabels } from "./LevelMembers";
import CoordinatorsBox, { type CoordinatorsBoxLabels } from "./CoordinatorsBox";

const EMPTY_BORROWED: GroupBorrowedApproversDto = { candidates: [], creatorMustSign: false, stepwiseEdit: false };

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
    const tJobTitle = useTranslations("Attendance.JobTitle");
    const codeWithRank = (code: string, rank: number) => tJobTitle("codeWithRank", { code, rank });
    const { user } = useAuth();
    // Coordinators may look at the trees, only Admin may change them.
    const isAdmin = Boolean(user?.roles.includes("Admin"));
    // Coordinators can open this screen but lack *Coordinator.View, so hide these blocks or they'd hit 403.
    const canManageDeptCoordinators = hasPermission(user, "Attendance.DepartmentApprovalStepCoordinator.View");
    const canManageGroupCoordinators = hasPermission(user, "Attendance.GroupApprovalStepCoordinator.View");

    const [departments, setDepartments] = useState<ApprovalTreeDepartmentDto[]>([]);
    const [groups, setGroups] = useState<GroupDto[]>([]);
    const [deptJobTitles, setDeptJobTitles] = useState<JobTitleDto[]>([]);
    const [groupJobTitles, setGroupJobTitles] = useState<JobTitleDto[]>([]);
    const [departmentId, setDepartmentId] = useState<number | "">("");
    // Workshop scoping Manager holders and groups; defaults to the first workshop until one is picked.
    const [workshops, setWorkshops] = useState<WorkshopDto[]>([]);
    const [pickedWorkshopId, setPickedWorkshopId] = useState<number | "">("");
    const workshopId: number | "" = pickedWorkshopId === "" ? (workshops.length > 0 ? workshops[0].id : "") : pickedWorkshopId;
    const [isLoadingOptions, setIsLoadingOptions] = useState(true);
    // ── Department (terminal) block ──
    const [deptSteps, setDeptSteps] = useState<DepartmentApprovalStepDto[]>([]);
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
    const [isLoadingGroupSteps, setIsLoadingGroupSteps] = useState(false);
    const [isSavingGroup, setIsSavingGroup] = useState(false);
    const [isGroupDirty, setIsGroupDirty] = useState(false);
    const [groupEmployees, setGroupEmployees] = useState<EmployeeDto[]>([]);
    const [groupBorrowed, setGroupBorrowed] = useState<GroupBorrowedApproversDto>(EMPTY_BORROWED);
    const [groupCoordinators, setGroupCoordinators] = useState<GroupApprovalStepCoordinatorDto[]>([]);
    const [isLoadingGroupCoordinators, setIsLoadingGroupCoordinators] = useState(false);
    const [isSavingGroupCoordinators, setIsSavingGroupCoordinators] = useState(false);
    const [addingGroupCoordinatorEmployeeId, setAddingGroupCoordinatorEmployeeId] = useState<number | "">("");
    const [isApplyOpen, setIsApplyOpen] = useState(false);
    const [applyLevelId, setApplyLevelId] = useState<number | "">("");
    const [applyEmployeeId, setApplyEmployeeId] = useState<number | "">("");
    const [applyGroupIds, setApplyGroupIds] = useState<number[]>([]);
    const [isApplying, setIsApplying] = useState(false);
    const [holderToRemove, setHolderToRemove] = useState<EmployeeDto | null>(null);

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
        EmployeeApi.getEmployeesByGroup(targetGroupId)
            .then((data) => setGroupEmployees(data))
            .catch((err) => {
                console.error(err);
                toast.error(getApiErrorMessage(err, tGroup("loadEmployeesError")));
            });
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
            }
            if (typeof groupId === "number") {
                fetchGroupSteps(groupId);
                fetchGroupEmployees(groupId);
                fetchGroupBorrowed(groupId);
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
        setIsDeptDirty(false);
        // The selected group no longer belongs to the new department.
        setGroupId("");
        setGroupSteps([]);
        setGroupEmployees([]);
        setGroupBorrowed(EMPTY_BORROWED);
        setGroupCoordinators([]);
        setIsGroupDirty(false);
        if (typeof value === "number") {
            fetchDeptSteps(value);
            fetchDeptEmployees(value);
            fetchDeptCoordinators(value);
        }
    };

    const handleSelectDepartment = (value: number | "") => {
        applyOrConfirmDiscard(isDeptDirty || isGroupDirty, () => selectDepartmentNow(value));
    };

    const selectGroupNow = (value: number | "") => {
        setGroupId(value);
        setGroupSteps([]);
        setGroupEmployees([]);
        setGroupBorrowed(EMPTY_BORROWED);
        setGroupCoordinators([]);
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

    const selectWorkshopNow = (value: number | "") => {
        setPickedWorkshopId(value);
        setGroupId("");
        setGroupSteps([]);
        setGroupEmployees([]);
        setGroupBorrowed(EMPTY_BORROWED);
        setGroupCoordinators([]);
        setIsGroupDirty(false);
        if (typeof departmentId === "number") fetchDeptEmployees(departmentId, value);
    };

    const handleSelectWorkshop = (value: number | "") => {
        applyOrConfirmDiscard(isGroupDirty, () => selectWorkshopNow(value));
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

    const handlePickDeptHolder = async (jobTitleId: number, employeeId: number | "") => {
        setAddingDeptHolderByJobTitle((current) => ({ ...current, [jobTitleId]: employeeId }));
        if (employeeId === "") return;
        const employee = deptPool.find((e) => e.id === employeeId);
        if (!employee) return;
        await handleAssignDeptJobTitle(employee, jobTitleId);
        setAddingDeptHolderByJobTitle((current) => ({ ...current, [jobTitleId]: "" }));
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

    // Group coordinators may come from anywhere in the Department: own members first, then the department picker.
    const groupCoordinatorPool = [...groupEmployees, ...deptPool.filter((e) => !groupEmployees.some((g) => g.id === e.id))];

    const handleAddGroupCoordinator = async (employeeId: number | "") => {
        setAddingGroupCoordinatorEmployeeId(employeeId);
        if (employeeId === "" || typeof groupId !== "number") return;
        const employee = groupCoordinatorPool.find((e) => e.id === employeeId);
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

    const groupPeople = groupBorrowed.candidates;
    const buildMemberOptions = (excludeEmployeeIds: Set<number>): SelectOption[] =>
        groupPeople
            .filter((p) => !excludeEmployeeIds.has(p.employeeId))
            .map((p) => ({
                value: p.employeeId,
                label: `${p.lastName} ${p.firstName} (${p.employeeCode})${p.jobTitleName ? ` — ${p.jobTitleName}` : ""}`,
                searchText: `${p.lastName} ${p.firstName} ${p.employeeCode} ${p.groupNameVn ?? ""} ${p.jobTitleName ?? ""}`.toLowerCase(),
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

    const handleAddDeptStep = (jobTitleId: number | "") => {
        const jobTitle = deptJobTitles.find((jt) => jt.id === jobTitleId);
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

    // One save for the whole screen: persists whichever of the two blocks has pending changes.
    const handleSaveAll = async () => {
        if (isGroupDirty && !groupSigningMinNotMet && !groupLevelIncomplete && !groupRepeatedNames) await handleSaveGroup();
        if (isDeptDirty) await handleSaveDept();
    };

    // ── Group block: add/remove/reorder/save ──
    const usedGroupJobTitleIds = new Set(groupSteps.map((s) => s.jobTitleId));
    const availableGroupJobTitles = groupJobTitles.filter((jt) => !usedGroupJobTitleIds.has(jt.id));

    // The YEV-22-024 printout has exactly 2 fixed "requester" boxes.
    const groupSigningCount = groupSteps.filter((s) => s.requiresSignature).length + (groupBorrowed.creatorMustSign ? 1 : 0);
    const groupSigningLimitReached = groupSigningCount >= 2;
    const groupSigningMinNotMet = groupSteps.length > 0 && groupSigningCount === 0;
    const groupLevelIncomplete = groupSteps.some((s) => !s.members.some((m) => m.receivesMail));
    // One person per level in a Group, or they would approve and sign the same form twice.
    const groupMemberIds = new Set(groupSteps.flatMap((s) => s.members.map((m) => m.employeeId)));
    const groupRepeatedNames = [
        ...new Set(
            groupSteps
                .flatMap((s) => s.members)
                .filter((m, i, all) => all.findIndex((o) => o.employeeId === m.employeeId) !== i)
                .map((m) => `${m.lastName} ${m.firstName}`)
        ),
    ].join(", ");

    const handleAddGroupStep = (jobTitleId: number | "") => {
        const jobTitle = groupJobTitles.find((jt) => jt.id === jobTitleId);
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
                resubmitSkipsIntermediate: false,
                terminalLevel: jobTitle.terminalLevel,
                members: [],
            },
        ]);
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

    const handleToggleCreatorSignature = () => {
        if (!groupBorrowed.creatorMustSign && groupSigningLimitReached) {
            toast.error(tGroup("signingLimitToggleError"));
            return;
        }
        setGroupBorrowed((current) => ({ ...current, creatorMustSign: !current.creatorMustSign }));
        setIsGroupDirty(true);
    };

    const updateStepMembers = (index: number, update: (members: GroupApprovalStepDto["members"]) => GroupApprovalStepDto["members"]) => {
        setGroupSteps((current) => current.map((step, i) => (i === index ? { ...step, members: update(step.members) } : step)));
        setIsGroupDirty(true);
    };

    const handleAddStepMember = (index: number, person: GroupBorrowedApproverDto) =>
        updateStepMembers(index, (members) => [
            ...members,
            {
                employeeId: person.employeeId,
                employeeCode: person.employeeCode,
                lastName: person.lastName,
                firstName: person.firstName,
                groupNameVn: person.groupNameVn,
                receivesMail: true,
            },
        ]);

    const openApplyDialog = async () => {
        // Applying reloads the tree from the server, so pending edits have to be stored first.
        if (isGroupDirty) {
            if (groupRepeatedNames || groupLevelIncomplete || groupSigningMinNotMet) {
                toast.error(
                    groupRepeatedNames
                        ? tGroup("levelRepeatedHint", { names: groupRepeatedNames })
                        : tGroup(groupLevelIncomplete ? "levelIncompleteHint" : "intermediateMinHint")
                );
                return;
            }
            if (!(await handleSaveGroup())) return;
        }
        setIsApplyOpen(true);
        setApplyLevelId("");
        setApplyEmployeeId("");
        setApplyGroupIds(typeof groupId === "number" ? [groupId] : []);
    };

    const handleSubmitApply = async () => {
        if (applyLevelId === "" || applyEmployeeId === "" || applyGroupIds.length === 0) {
            toast.error(tGroup("applyMissing"));
            return;
        }
        setIsApplying(true);
        try {
            const result = await GroupApprovalStepApi.applyMember({
                employeeId: applyEmployeeId,
                jobTitleId: applyLevelId,
                receivesMail: true,
                groupIds: applyGroupIds,
            });
            toast.success(tGroup("applySuccess", { count: result.appliedCount }));
            if (result.skippedGroupNames.length > 0) toast.warning(tGroup("applySkipped", { names: result.skippedGroupNames.join(", ") }));
            if (result.onOtherLevelGroupNames.length > 0) toast.warning(tGroup("applyOnOtherLevel", { names: result.onOtherLevelGroupNames.join(", ") }));
            setIsApplyOpen(false);
            if (typeof groupId === "number") {
                fetchGroupSteps(groupId);
                fetchGroupBorrowed(groupId);
            }
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, tGroup("applyError")));
        } finally {
            setIsApplying(false);
        }
    };

    const handleToggleGroupResubmit = (index: number) => {
        setGroupSteps((current) =>
            current.map((step, i) => (i === index ? { ...step, canResubmit: !step.canResubmit, resubmitSkipsIntermediate: !step.canResubmit && step.resubmitSkipsIntermediate } : step))
        );
        setIsGroupDirty(true);
    };

    const handleToggleGroupResubmitSkip = (index: number) => {
        setGroupSteps((current) =>
            current.map((step, i) => (i === index ? { ...step, resubmitSkipsIntermediate: !step.resubmitSkipsIntermediate } : step))
        );
        setIsGroupDirty(true);
    };

    const handleReorderGroupSteps = (next: GroupApprovalStepDto[]) => {
        setGroupSteps(next);
        setIsGroupDirty(true);
    };
    const groupDrag = useDragReorder(groupSteps, handleReorderGroupSteps, (s) => s.jobTitleId);

    const handleSaveGroup = async () => {
        if (typeof groupId !== "number") return false;
        setIsSavingGroup(true);
        try {
            const data = await GroupApprovalStepApi.replaceByGroup(groupId, {
                steps: groupSteps.map((s) => ({
                    jobTitleId: s.jobTitleId,
                    requiresSignature: s.requiresSignature,
                    isResponsible: s.isResponsible,
                    canResubmit: s.canResubmit,
                    resubmitSkipsIntermediate: s.resubmitSkipsIntermediate,
                    members: s.members.map((m) => ({ employeeId: m.employeeId, receivesMail: m.receivesMail })),
                })),
                creatorMustSign: groupBorrowed.creatorMustSign,
                stepwiseEdit: groupBorrowed.stepwiseEdit,
            });
            setGroupSteps(data);
            setIsGroupDirty(false);
            toast.success(tGroup("saveSuccess"));
            return true;
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, tGroup("saveError")));
            return false;
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
        toggleResubmitSkipHint: tGroup("toggleResubmitSkipHint"),
        resubmitSkipYes: tGroup("resubmitSkipYes"),
        resubmitSkipNo: tGroup("resubmitSkipNo"),
    };
    const deptStepLabels: StepCardLabels = {
        dragHandleLabel: tDept("dragHandleLabel"),
        toggleSignatureHint: tDept("toggleSignatureHint"),
        requiresSignatureYes: tDept("requiresSignatureYes"),
        requiresSignatureNo: tDept("requiresSignatureNo"),
        removeStep: tDept("removeStep"),
    };
    const levelMembersLabels: LevelMembersLabels = {
        noMembers: tGroup("noMembers"),
        removeMember: tGroup("removeMember"),
        addPlaceholder: tJobTitle("addShort"),
        receivesMailOn: tGroup("receivesMailOn"),
        receivesMailOff: tGroup("receivesMailOff"),
    };
    const deptHoldersLabels: StepHoldersLabels = {
        holdersLabel: tDept("holdersLabel"),
        loadingEmployees: tDept("loadingEmployees"),
        noHolders: tDept("noHolders"),
        noHoldersHint: tDept("noHoldersHint"),
        removeHolderHint: tDept("removeHolderHint"),
        addHolderPlaceholder: tJobTitle("addShort"),
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
            <section className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-[#e0e3e5] bg-white px-3 py-2 shadow-sm">
                {workshops.length > 0 && (
                    <>
                        <span className="shrink-0 text-xs font-semibold uppercase tracking-[0.1em] text-[#5e3f3a]">{tDept("fieldWorkshop")}</span>
                        <div className="w-44 max-w-full">
                            <SearchableSelect
                                options={workshops.map((w) => ({ value: w.id, label: w.workshopNameVn, searchText: w.workshopNameVn.toLowerCase() }))}
                                value={workshopId}
                                onChange={handleSelectWorkshop}
                                placeholder={tDept("fieldWorkshopPlaceholder")}
                                disabled={isLoadingOptions}
                                triggerClassName={compactSelectClassName}
                            />
                        </div>
                    </>
                )}
                <span className="ml-2 shrink-0 text-xs font-semibold uppercase tracking-[0.1em] text-[#5e3f3a]">{tDept("fieldDepartment")}</span>
                <div className="w-64 max-w-full">
                    <SearchableSelect
                        options={departmentOptions}
                        value={departmentId}
                        onChange={handleSelectDepartment}
                        placeholder={tDept("fieldDepartmentPlaceholder")}
                        disabled={isLoadingOptions}
                        triggerClassName={compactSelectClassName}
                    />
                </div>
                {typeof departmentId === "number" && (
                    <>
                        <span className="ml-2 shrink-0 text-xs font-semibold uppercase tracking-[0.1em] text-[#5e3f3a]">{tGroup("fieldGroup")}</span>
                        <div className="w-64 max-w-full">
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
                {typeof departmentId === "number" && isAdmin && (
                    <button
                        type="button"
                        onClick={handleSaveAll}
                        disabled={!(isGroupDirty || isDeptDirty) || isSavingGroup || isSavingDept || groupSigningMinNotMet || groupLevelIncomplete || !!groupRepeatedNames}
                        className="ml-auto cursor-pointer rounded-md bg-[#e3000f] px-3 py-1.5 text-xs! font-semibold! text-white transition hover:bg-[#b40009] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {isSavingGroup || isSavingDept ? tGroup("saving") : tGroup("saveButton")}
                    </button>
                )}
            </section>

            {typeof departmentId === "number" && (
                // Left: the merged group → department pipeline; right: sticky config panel so selectors don't break the pipeline.
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_300px]">
                    <div className="@container order-2 space-y-4 rounded-xl border border-[#e0e3e5] bg-white p-4 shadow-sm lg:order-1">
                        {/* Intermediate levels — the form passes these first */}
                        <div>
                            <StepSectionHeader columns={typeof groupId === "number" && <StepColumnHeaders showResponsible showResubmit signUsed={groupSigningCount} signHint={tGroup("intermediateLimitHint")} />}>
                                <FolderOpen className="h-4 w-4 text-[#e3000f]" />
                                <h3 className={sectionTitleClassName}>{tGroup("sectionTitle")}</h3>
                                {typeof groupId === "number" && !isLoadingGroupSteps && isAdmin && (
                                    <button
                                        type="button"
                                        onClick={openApplyDialog}
                                        disabled={isSavingGroup}
                                        className="ml-1 inline-flex h-7 shrink-0 cursor-pointer items-center gap-1 whitespace-nowrap rounded-md border border-[#e0e3e5] bg-white px-2 text-xs! font-semibold! text-[#5e3f3a] transition hover:bg-[#f2f4f6] disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        <Layers size={13} />
                                        {tGroup("applyToGroups")}
                                    </button>
                                )}
                            </StepSectionHeader>

                            {typeof groupId !== "number" ? (
                                <p className="text-sm italic text-[#8a8f94]">{tGroup("chooseGroupHint")}</p>
                            ) : isLoadingGroupSteps ? (
                                loadingStepsSkeleton
                            ) : (
                                <>
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
                                                    resubmitSkipsIntermediate={step.resubmitSkipsIntermediate}
                                                    onToggleResubmitSkip={() => handleToggleGroupResubmitSkip(index)}
                                                    onRemove={() => handleRemoveGroupStep(index)}
                                                    labels={groupStepLabels}
                                                    readOnly={!isAdmin}
                                                    signLocked={groupSigningLimitReached}
                                                    footer={
                                                        <LevelMembers
                                                            members={step.members}
                                                            currentGroupName={groups.find((g) => g.id === groupId)?.groupNameVn}
                                                            addOptions={buildMemberOptions(groupMemberIds)}
                                                            onAdd={(employeeId) => {
                                                                const person = groupPeople.find((p) => p.employeeId === employeeId);
                                                                if (person) handleAddStepMember(index, person);
                                                            }}
                                                            onRemove={(employeeId) =>
                                                                updateStepMembers(index, (members) => members.filter((m) => m.employeeId !== employeeId))
                                                            }
                                                            onToggleMail={(employeeId) =>
                                                                updateStepMembers(index, (members) =>
                                                                    members.map((m) => (m.employeeId === employeeId ? { ...m, receivesMail: !m.receivesMail } : m))
                                                                )
                                                            }
                                                            labels={levelMembersLabels}
                                                            readOnly={!isAdmin}
                                                        />
                                                    }
                                                />
                                            ))}
                                    </ol>

                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-[#e0e3e5] pt-3">
                                        {isAdmin && <div className="w-64 max-w-full">
                                            <SearchableSelect
                                                options={toJobTitleOptions(availableGroupJobTitles, codeWithRank)}
                                                value=""
                                                onChange={handleAddGroupStep}
                                                placeholder={tGroup("fieldAddJobTitlePlaceholder")}
                                                triggerClassName={compactSelectClassName}
                                            />
                                        </div>}
                                        <label className="flex cursor-pointer items-center gap-2 text-xs text-[#191c1e]">
                                            <input
                                                type="checkbox"
                                                checked={groupBorrowed.creatorMustSign}
                                                onChange={handleToggleCreatorSignature}
                                                disabled={!isAdmin || (groupSigningLimitReached && !groupBorrowed.creatorMustSign)}
                                                className="h-4 w-4 cursor-pointer accent-[#e3000f] disabled:cursor-not-allowed"
                                            />
                                            {tGroup("creatorMustSignLabel")}
                                        </label>
                                        <label className="flex cursor-pointer items-center gap-2 text-xs text-[#191c1e]" title={tGroup("stepwiseEditHint")}>
                                            <input
                                                type="checkbox"
                                                checked={groupBorrowed.stepwiseEdit}
                                                onChange={() => {
                                                    setGroupBorrowed((current) => ({ ...current, stepwiseEdit: !current.stepwiseEdit }));
                                                    setIsGroupDirty(true);
                                                }}
                                                disabled={!isAdmin}
                                                className="h-4 w-4 cursor-pointer accent-[#e3000f] disabled:cursor-not-allowed"
                                            />
                                            {tGroup("stepwiseEditLabel")}
                                        </label>
                                    </div>
                                    {isAdmin && groupSigningMinNotMet && <p className="text-xs text-[#930006]">{tGroup("intermediateMinHint")}</p>}
                                    {isAdmin && groupLevelIncomplete && <p className="text-xs text-[#930006]">{tGroup("levelIncompleteHint")}</p>}
                                    {isAdmin && groupRepeatedNames && <p className="text-xs text-[#930006]">{tGroup("levelRepeatedHint", { names: groupRepeatedNames })}</p>}

                                </>
                            )}
                        </div>

                        {/* Terminal levels — after the group block */}
                        <div>
                            <StepSectionHeader columns={deptSteps.length > 0 && <StepColumnHeaders />}>
                                <FolderOpen className="h-4 w-4 text-[#e3000f]" />
                                <h3 className={sectionTitleClassName}>{tDept("sectionTitle")}</h3>
                            </StepSectionHeader>

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
                                                    readOnly={!isAdmin}
                                                    footer={
                                                        <StepHolders
                                                            holders={deptEmployees.filter((e) => e.jobTitleId === step.jobTitleId)}
                                                            isLoadingEmployees={isLoadingDeptEmployees}
                                                            removingHolderId={assigningDeptEmployeeId}
                                                            onRemoveHolder={(holder) => setHolderToRemove(holder as EmployeeDto)}
                                                            addOptions={buildHolderOptions(deptPool, step.jobTitleId)}
                                                            onAddQueryChange={handleDeptPickerQuery}
                                                            addingValue={addingDeptHolderByJobTitle[step.jobTitleId] ?? ""}
                                                            onAddChange={(v) => handlePickDeptHolder(step.jobTitleId, v)}
                                                            labels={deptHoldersLabels}
                                                            readOnly={!isAdmin}
                                                        />
                                                    }
                                                />
                                            ))}
                                        </ol>
                                    )}

                                    {isAdmin && <div className="flex flex-wrap items-center gap-2 border-t border-[#e0e3e5] pt-3">
                                        <div className="w-64 max-w-full">
                                            <SearchableSelect
                                                options={toJobTitleOptions(availableDeptJobTitles, codeWithRank)}
                                                value=""
                                                onChange={handleAddDeptStep}
                                                placeholder={tDept("fieldAddJobTitlePlaceholder")}
                                                triggerClassName={compactSelectClassName}
                                            />
                                        </div>
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
                                addOptions={buildCoordinatorOptions(groupCoordinatorPool, new Set(groupCoordinators.map((c) => c.employeeId)))}
                                onAddQueryChange={handleDeptPickerQuery}
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

            <FormDialog
                isOpen={isApplyOpen}
                title={tGroup("applyTitle")}
                onClose={() => setIsApplyOpen(false)}
                onSubmit={handleSubmitApply}
                loading={isApplying}
                submitLabel={tGroup("applySubmit")}
                cancelLabel={tGroup("applyCancel")}
            >
                <label className="block">
                    <span className="mb-1 block text-xs font-medium text-[#5e3f3a]">{tGroup("applyLevelLabel")}</span>
                    <SearchableSelect
                        options={groupSteps.map((s) => ({ value: s.jobTitleId, label: s.jobTitleName, searchText: s.jobTitleName.toLowerCase() }))}
                        value={applyLevelId}
                        onChange={setApplyLevelId}
                        placeholder={tGroup("applyLevelPlaceholder")}
                    />
                </label>
                <label className="block">
                    <span className="mb-1 block text-xs font-medium text-[#5e3f3a]">{tGroup("applyPersonLabel")}</span>
                    <SearchableSelect
                        options={buildMemberOptions(new Set())}
                        value={applyEmployeeId}
                        onChange={setApplyEmployeeId}
                        placeholder={tGroup("addMemberPlaceholder")}
                    />
                </label>
                <div>
                    <span className="mb-1 block text-xs font-medium text-[#5e3f3a]">{tGroup("fieldGroup")}</span>
                    <MultiSelect
                        options={groupOptions.map((o) => ({ value: Number(o.value), label: o.label, searchText: o.searchText }))}
                        values={applyGroupIds}
                        onChange={setApplyGroupIds}
                        placeholder={tGroup("fieldGroupPlaceholder")}
                    />
                </div>
            </FormDialog>

            <ConfirmDialog
                isOpen={holderToRemove !== null}
                title={tDept("removeHolderConfirmTitle")}
                message={tDept("removeHolderConfirmMessage", { name: holderToRemove ? `${holderToRemove.lastName} ${holderToRemove.firstName}` : "" })}
                approveLabel={tDept("removeHolderConfirmApprove")}
                loading={assigningDeptEmployeeId !== null}
                onApprove={async () => {
                    if (holderToRemove) await handleAssignDeptJobTitle(holderToRemove, "");
                    setHolderToRemove(null);
                }}
                onDenied={() => setHolderToRemove(null)}
            />

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

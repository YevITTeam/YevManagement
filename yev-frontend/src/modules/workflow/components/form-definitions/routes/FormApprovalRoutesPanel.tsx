"use client";

import { useState } from "react";
import { Plus, Save, Route } from "lucide-react";
import { toast } from "react-toastify";
import { useTranslations } from "next-intl";
import { FormDefinitionApi } from "@/modules/workflow/api/form-definition.api";
import { EmployeeApi } from "@/modules/workflow/api/employee.api";
import { JobTitleApi } from "@/modules/workflow/api/job-title.api";
import { OrgUnitApi } from "@/modules/workflow/api/org-unit.api";
import type { RouteConditionType } from "@/modules/workflow/types/form-definition.dto";
import { ParticipantRole } from "@/modules/workflow/types/form-route.dto";
import type { OrgUnitTreeDto } from "@/modules/workflow/types/org-unit.dto";
import type { SelectOption } from "@/components/ui/SearchableSelect";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/common/EmptyState";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";
import { getApiErrorMessage } from "@/lib/apiError";
import { createDefaultRoute, fromRouteDto, toReplaceRouteItem, type EditableRoute } from "./editableRoute";
import RouteCard from "./RouteCard";

interface FormApprovalRoutesPanelProps {
    formDefinitionId: number;
    routeConditionType: RouteConditionType;
}

// Đơn vị cha hiển thị thụt lề theo độ sâu trong cây (mirror flattenOrgUnits ở FormAccessesPanel.tsx).
function flattenOrgUnits(nodes: OrgUnitTreeDto[], depth = 0): SelectOption[] {
    const result: SelectOption[] = [];
    for (const node of nodes) {
        const label = `${"— ".repeat(depth)}${node.code} · ${node.nameVn}`;
        result.push({ value: node.id, label, searchText: `${node.code} ${node.nameVn}`.toLowerCase() });
        result.push(...flattenOrgUnits(node.children, depth + 1));
    }
    return result;
}

export interface OrgUnitAncestorInfo {
    parentId: number | null;
    orgLevelId: number;
    nameVn: string;
}

// Map tra cứu ParentId — cây gốc (OrgUnitTreeDto) không mang ParentId (chỉ có children lồng nhau),
// nên phải tự dựng lúc duyệt đệ quy để nút "Điền chuỗi duyệt" đi ngược lên cây tổ chức được.
function buildOrgUnitsById(nodes: OrgUnitTreeDto[], parentId: number | null, acc: Map<number, OrgUnitAncestorInfo>): void {
    for (const node of nodes) {
        acc.set(node.id, { parentId, orgLevelId: node.orgLevelId, nameVn: node.nameVn });
        buildOrgUnitsById(node.children, node.id, acc);
    }
}

// Cấu hình nhánh + bước duyệt + người duyệt (workflow-module.md §3.2 FormRoutes/FormApprovalSteps/
// FormApprovalStepParticipants) — thuần cấu hình, CHƯA nộp được đơn thật (Pha 3B). Không autosave,
// mirror mọi panel khác trong module: 1 nút "Lưu thay đổi" gửi lại TOÀN BỘ cây nhánh+bước+người.
export default function FormApprovalRoutesPanel({ formDefinitionId, routeConditionType }: FormApprovalRoutesPanelProps) {
    const t = useTranslations("Workflow.FormDefinition");
    const [routes, setRoutes] = useState<EditableRoute[]>([]);
    const [orgUnitOptions, setOrgUnitOptions] = useState<SelectOption[]>([]);
    const [orgUnitsById, setOrgUnitsById] = useState<Map<number, OrgUnitAncestorInfo>>(new Map());
    const [employeeOptions, setEmployeeOptions] = useState<SelectOption[]>([]);
    const [jobTitleOptions, setJobTitleOptions] = useState<SelectOption[]>([]);
    const [isSaving, setIsSaving] = useState(false);

    const { isLoading, error } = useFetchEffect(
        async () => {
            const [routeList, orgUnitTree, employees, jobTitles] = await Promise.all([
                FormDefinitionApi.getRoutes(formDefinitionId),
                OrgUnitApi.getOrgUnitTree(),
                EmployeeApi.getEmployeePageNation({ pageSize: 1000 }),
                JobTitleApi.getAllJobTitles(),
            ]);
            return { routeList, orgUnitTree, employees: employees.data, jobTitles };
        },
        [formDefinitionId],
        (result) => {
            setRoutes(result.routeList.map(fromRouteDto));
            setOrgUnitOptions(flattenOrgUnits(result.orgUnitTree));
            const ancestorMap = new Map<number, OrgUnitAncestorInfo>();
            buildOrgUnitsById(result.orgUnitTree, null, ancestorMap);
            setOrgUnitsById(ancestorMap);
            setEmployeeOptions(
                result.employees
                    .filter((x) => x.isActive)
                    .map((x) => ({ value: x.id, label: `${x.fullName} (${x.employeeCode})`, searchText: `${x.employeeCode} ${x.fullName}`.toLowerCase() }))
            );
            setJobTitleOptions(result.jobTitles.map((x) => ({ value: x.id, label: x.nameVn, searchText: `${x.code} ${x.nameVn}`.toLowerCase() })));
        },
        t("loadRoutesError"),
        (message) => toast.error(message)
    );

    const addRoute = () => setRoutes((current) => [...current, createDefaultRoute(t("routeDefaultName", { order: current.length + 1 }))]);
    const updateRoute = (clientId: string, patch: Partial<EditableRoute>) =>
        setRoutes((current) => current.map((r) => (r.clientId === clientId ? { ...r, ...patch } : r)));
    const removeRoute = (clientId: string) => setRoutes((current) => current.filter((r) => r.clientId !== clientId));
    const moveRoute = (fromIndex: number, toIndex: number) => {
        if (toIndex < 0 || toIndex >= routes.length) return;
        setRoutes((current) => {
            const next = [...current];
            const [moved] = next.splice(fromIndex, 1);
            next.splice(toIndex, 0, moved);
            return next;
        });
    };

    // Kiểm tra trước khi gửi API — 2 lỗi này BE cũng chặn (FormDefinitionService.cs GuardParticipantTarget
    // + "phải có ít nhất 1 người duyệt"), nhưng chặn sẵn ở FE để chỉ đúng nhánh/bước bị thiếu thay vì
    // chỉ có 1 thông báo chung chung sau khi round-trip lên BE.
    const findRouteValidationError = (): string | null => {
        for (const route of routes) {
            for (const step of route.steps) {
                const missingParticipant = step.participants.some((p) => p.employeeId === null && p.jobTitleId === null);
                if (missingParticipant) {
                    return t("validationParticipantTargetMissing", { route: route.nameVn, step: step.nameVn });
                }
                const hasApprover = step.participants.some((p) => p.participantRole === ParticipantRole.Approver);
                if (!hasApprover) {
                    return t("validationStepNoApprover", { route: route.nameVn, step: step.nameVn });
                }
            }
        }
        return null;
    };

    const handleSave = async () => {
        const validationError = findRouteValidationError();
        if (validationError) {
            toast.error(validationError);
            return;
        }
        setIsSaving(true);
        try {
            const result = await FormDefinitionApi.replaceRoutes(formDefinitionId, routes.map(toReplaceRouteItem));
            setRoutes(result.map(fromRouteDto));
            toast.success(t("saveRoutesSuccess"));
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, t("saveRoutesError")));
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <div className="space-y-3">
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
            </div>
        );
    }

    if (error) {
        return <div className="rounded-lg border border-[#e9bcb6] bg-[#fff4f2] px-4 py-3 text-sm text-[#930006]">{error}</div>;
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <p className="text-sm text-[#5e3f3a]">{t("routesHint")}</p>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={addRoute}
                        className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#e0e3e5] bg-white px-3 py-1.5 text-xs font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6]"
                    >
                        <Plus className="h-3.5 w-3.5" /> {t("addRoute")}
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={isSaving}
                        className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-[#e3000f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#b40009] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        <Save className="h-3.5 w-3.5" /> {isSaving ? t("saving") : t("saveChanges")}
                    </button>
                </div>
            </div>

            {routes.length === 0 ? (
                <div className="rounded-lg border border-dashed border-[#e0e3e5]">
                    <EmptyState icon={Route} title={t("noRoutes")} />
                </div>
            ) : (
                <div className="space-y-3">
                    {routes.map((route, index) => (
                        <RouteCard
                            key={route.clientId}
                            route={route}
                            index={index}
                            totalRoutes={routes.length}
                            routeConditionType={routeConditionType}
                            orgUnitOptions={orgUnitOptions}
                            orgUnitsById={orgUnitsById}
                            employeeOptions={employeeOptions}
                            jobTitleOptions={jobTitleOptions}
                            onChange={(patch) => updateRoute(route.clientId, patch)}
                            onMoveUp={() => moveRoute(index, index - 1)}
                            onMoveDown={() => moveRoute(index, index + 1)}
                            onRemove={() => removeRoute(route.clientId)}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

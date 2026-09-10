"use client";

import { useState } from "react";
import { Plus, Trash2, Save, ShieldCheck } from "lucide-react";
import { toast } from "react-toastify";
import { useTranslations } from "next-intl";
import { FormDefinitionApi } from "@/modules/workflow/api/form-definition.api";
import { EmployeeApi } from "@/modules/workflow/api/employee.api";
import { OrgUnitApi } from "@/modules/workflow/api/org-unit.api";
import { AuthApi } from "@/modules/auth/api/auth.api";
import { AccessTargetType, type ReplaceFormAccessItemDto } from "@/modules/workflow/types/form-access.dto";
import type { OrgUnitTreeDto } from "@/modules/workflow/types/org-unit.dto";
import { SearchableSelect, type SelectOption } from "@/components/ui/SearchableSelect";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/common/EmptyState";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";
import { getApiErrorMessage } from "@/lib/apiError";

interface FormAccessesPanelProps {
    formDefinitionId: number;
}

const selectClassName =
    "h-9 w-full rounded-lg border border-[#e0e3e5] bg-white px-2 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3]";

// Đơn vị cha hiển thị thụt lề theo độ sâu trong cây (mirror flattenOrgUnits ở FormCategoryForm.tsx).
function flattenOrgUnits(nodes: OrgUnitTreeDto[], depth = 0): SelectOption[] {
    const result: SelectOption[] = [];
    for (const node of nodes) {
        const label = `${"— ".repeat(depth)}${node.code} · ${node.nameVn}`;
        result.push({ value: node.id, label, searchText: `${node.code} ${node.nameVn}`.toLowerCase() });
        result.push(...flattenOrgUnits(node.children, depth + 1));
    }
    return result;
}

// Ai được TẠO ĐƠN form này (workflow-module.md §3.2 FormAccesses) — khác FormCategoryCoordinators
// (ai SỬA cấu hình). Không autosave, giống hệt FormFieldConditionsPanel: sửa state cục bộ, 1 nút Lưu
// gửi lại toàn bộ danh sách (PUT thay nguyên danh sách).
export default function FormAccessesPanel({ formDefinitionId }: FormAccessesPanelProps) {
    const t = useTranslations("Workflow.FormDefinition");
    const [roleOptions, setRoleOptions] = useState<SelectOption[]>([]);
    const [orgUnitOptions, setOrgUnitOptions] = useState<SelectOption[]>([]);
    const [employeeOptions, setEmployeeOptions] = useState<SelectOption[]>([]);
    const [items, setItems] = useState<ReplaceFormAccessItemDto[]>([]);
    const [isSaving, setIsSaving] = useState(false);

    const { isLoading, error } = useFetchEffect(
        async () => {
            const [accesses, roles, orgUnitTree, employees] = await Promise.all([
                FormDefinitionApi.getAccesses(formDefinitionId),
                AuthApi.getAllRoles(),
                OrgUnitApi.getOrgUnitTree(),
                EmployeeApi.getEmployeePageNation({ pageSize: 1000 }),
            ]);
            return { accesses, roles, orgUnitTree, employees: employees.data };
        },
        [formDefinitionId],
        (result) => {
            setItems(
                result.accesses.map((x) => ({
                    targetType: x.targetType,
                    roleId: x.roleId,
                    orgUnitId: x.orgUnitId,
                    employeeId: x.employeeId,
                }))
            );
            setRoleOptions(result.roles.map((r) => ({ value: r.id, label: r.roleName, searchText: r.roleName.toLowerCase() })));
            setOrgUnitOptions(flattenOrgUnits(result.orgUnitTree));
            setEmployeeOptions(
                result.employees
                    .filter((x) => x.isActive)
                    .map((x) => ({ value: x.id, label: `${x.fullName} (${x.employeeCode})`, searchText: `${x.employeeCode} ${x.fullName}`.toLowerCase() }))
            );
        },
        t("loadAccessesError"),
        (message) => toast.error(message)
    );

    const addRow = () => {
        setItems((current) => [...current, { targetType: AccessTargetType.Employee, roleId: null, orgUnitId: null, employeeId: null }]);
    };

    const removeRow = (index: number) => setItems((current) => current.filter((_, i) => i !== index));

    const updateRow = (index: number, patch: Partial<ReplaceFormAccessItemDto>) =>
        setItems((current) => current.map((item, i) => (i === index ? { ...item, ...patch } : item)));

    const changeTargetType = (index: number, targetType: AccessTargetType) =>
        updateRow(index, { targetType, roleId: null, orgUnitId: null, employeeId: null });

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const result = await FormDefinitionApi.replaceAccesses(formDefinitionId, items);
            setItems(result.map((x) => ({ targetType: x.targetType, roleId: x.roleId, orgUnitId: x.orgUnitId, employeeId: x.employeeId })));
            toast.success(t("saveAccessesSuccess"));
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, t("saveAccessesError")));
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <div className="space-y-3">
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-full" />
            </div>
        );
    }

    if (error) {
        return <div className="rounded-lg border border-[#e9bcb6] bg-[#fff4f2] px-4 py-3 text-sm text-[#930006]">{error}</div>;
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <p className="text-sm text-[#5e3f3a]">{t("accessesHint")}</p>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={addRow}
                        className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#e0e3e5] bg-white px-3 py-1.5 text-xs font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6]"
                    >
                        <Plus className="h-3.5 w-3.5" /> {t("addAccess")}
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

            {items.length === 0 ? (
                <div className="rounded-lg border border-dashed border-[#e0e3e5]">
                    <EmptyState icon={ShieldCheck} title={t("noAccesses")} />
                </div>
            ) : (
                <div className="space-y-3">
                    {items.map((item, index) => (
                        <div key={index} className="flex items-end gap-3 rounded-lg border border-[#e0e3e5] bg-white p-3">
                            <label className="block w-40 shrink-0">
                                <span className="mb-1 block text-[11px] font-semibold uppercase text-[#8a8f94]">{t("accessTargetType")}</span>
                                <select
                                    value={item.targetType}
                                    onChange={(event) => changeTargetType(index, Number(event.target.value) as AccessTargetType)}
                                    className={selectClassName}
                                >
                                    <option value={AccessTargetType.Employee}>{t("targetTypeEmployee")}</option>
                                    <option value={AccessTargetType.OrgUnit}>{t("targetTypeOrgUnit")}</option>
                                    <option value={AccessTargetType.Role}>{t("targetTypeRole")}</option>
                                </select>
                            </label>

                            <div className="flex-1">
                                <span className="mb-1 block text-[11px] font-semibold uppercase text-[#8a8f94]">{t("accessTarget")}</span>
                                {item.targetType === AccessTargetType.Employee && (
                                    <SearchableSelect
                                        options={employeeOptions}
                                        value={item.employeeId ?? ""}
                                        onChange={(v) => updateRow(index, { employeeId: v === "" ? null : v })}
                                        placeholder={t("accessTargetPlaceholderEmployee")}
                                        triggerClassName={selectClassName}
                                    />
                                )}
                                {item.targetType === AccessTargetType.OrgUnit && (
                                    <SearchableSelect
                                        options={orgUnitOptions}
                                        value={item.orgUnitId ?? ""}
                                        onChange={(v) => updateRow(index, { orgUnitId: v === "" ? null : v })}
                                        placeholder={t("accessTargetPlaceholderOrgUnit")}
                                        triggerClassName={selectClassName}
                                    />
                                )}
                                {item.targetType === AccessTargetType.Role && (
                                    <SearchableSelect
                                        options={roleOptions}
                                        value={item.roleId ?? ""}
                                        onChange={(v) => updateRow(index, { roleId: v === "" ? null : v })}
                                        placeholder={t("accessTargetPlaceholderRole")}
                                        triggerClassName={selectClassName}
                                    />
                                )}
                            </div>

                            <button
                                type="button"
                                onClick={() => removeRow(index)}
                                className="flex shrink-0 cursor-pointer items-center gap-1 pb-2 text-xs font-semibold text-[#930006] hover:text-[#e3000f]"
                            >
                                <Trash2 className="h-3.5 w-3.5" /> {t("removeAccess")}
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
